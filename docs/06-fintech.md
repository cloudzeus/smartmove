# 06 — Fintech (Viva Wallet + AADE myDATA)

## A. Viva Wallet Integration

### Authentication

Viva χρησιμοποιεί OAuth 2.0 client_credentials grant.

```typescript
// src/lib/viva/client.ts
import { env } from "@/lib/env";
import { redis } from "@/lib/redis";

const BASE = env.VIVA_ENV === "production"
  ? "https://api.vivapayments.com"
  : "https://demo-api.vivapayments.com";

const AUTH_BASE = env.VIVA_ENV === "production"
  ? "https://accounts.vivapayments.com"
  : "https://demo-accounts.vivapayments.com";

async function getAccessToken(): Promise<string> {
  const cacheKey = "viva:access_token";
  const cached = await redis.get(cacheKey);
  if (cached) return cached;

  const creds = Buffer.from(`${env.VIVA_CLIENT_ID}:${env.VIVA_CLIENT_SECRET}`).toString("base64");
  const r = await fetch(`${AUTH_BASE}/connect/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=urn:viva:payments:core:api:redirectcheckout",
  });
  if (!r.ok) throw new Error(`Viva auth failed: ${r.status}`);
  const json = await r.json();

  // Cache for slightly less than expiry
  await redis.set(cacheKey, json.access_token, "EX", json.expires_in - 60);
  return json.access_token;
}

export async function vivaFetch<T = any>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Viva ${path} ${r.status}: ${body}`);
  }
  return r.json();
}
```

### Create payment order (escrow pre-auth)

```typescript
// src/lib/viva/checkout.ts
import { vivaFetch } from "./client";
import { env } from "@/lib/env";

export async function createPaymentOrder(opts: {
  amountCents:   number;
  customerEmail: string;
  customerName:  string;
  description:   string;
  bookingId?:    string;
  preAuth?:      boolean;     // escrow pattern
}) {
  return vivaFetch<{ orderCode: number }>("/checkout/v2/orders", {
    method: "POST",
    body: JSON.stringify({
      amount:       opts.amountCents,
      preauth:      opts.preAuth ?? true,
      sourceCode:   env.VIVA_MERCHANT_ID,
      merchantTrns: opts.bookingId,
      customer: {
        email:     opts.customerEmail,
        fullName:  opts.customerName,
        requestLang: "el-GR",
      },
      customerTrns: opts.description,
      paymentTimeout: 1800,   // 30 min
      allowRecurring: false,
      tags: opts.bookingId ? [`booking:${opts.bookingId}`] : [],
    }),
  });
}

export async function captureCharge(opts: {
  transactionId: string;
  amountCents:   number;
}) {
  return vivaFetch(`/api/transactions/${opts.transactionId}`, {
    method: "POST",
    body: JSON.stringify({ amount: opts.amountCents }),
  });
}

export async function refund(opts: { transactionId: string; amountCents: number }) {
  return vivaFetch(`/api/transactions/${opts.transactionId}?Amount=${opts.amountCents}&SourceCode=${env.VIVA_MERCHANT_ID}`, {
    method: "DELETE",
  });
}
```

### Webhook verification

```typescript
// src/lib/viva/webhooks.ts
import crypto from "crypto";
import { env } from "@/lib/env";

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const expected = crypto
    .createHmac("sha256", env.VIVA_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("base64");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
```

### Webhook handler

```typescript
// src/app/api/payments/viva/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/viva/webhooks";
import { handleVivaEvent } from "@/server/services/payment.service";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-viva-signature") ?? "";
  if (!verifyWebhookSignature(raw, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(raw);
  await handleVivaEvent(event);

  return NextResponse.json({ received: true });
}
```

### Payment service (state machine)

```typescript
// src/server/services/payment.service.ts
export async function handleVivaEvent(event: any) {
  const eventType = event.EventTypeId; // 1796 = TransactionCreated, 1798 = TransactionRefund, ...
  const data = event.EventData;

  switch (eventType) {
    case 1796: // TransactionCreated — pre-auth completed
      await db.payment.update({
        where: { vivaOrderCode: String(data.OrderCode) },
        data: {
          status: "AUTHORIZED",
          vivaTransactionId: data.TransactionId,
          authorizedAt: new Date(),
        },
      });
      break;
    case 1797: // TransactionFailed
      await db.payment.update({
        where: { vivaOrderCode: String(data.OrderCode) },
        data: { status: "FAILED", failedAt: new Date(), failureReason: data.StatusId },
      });
      break;
    case 1798: // Refund
      await db.payment.update({
        where: { vivaTransactionId: data.TransactionId },
        data: {
          refundedAt: new Date(),
          refundedAmountCents: data.Amount,
          status: data.Amount >= data.OriginalAmount ? "REFUNDED" : "PARTIAL_REFUND",
        },
      });
      break;
    // TODO: capture, dispute, chargeback
  }
}
```

### Split payment to carrier (payout)

Όταν ολοκληρώνεται το booking (QR scanned), δεσμευμένα funds γίνονται captured. Η commission μένει στο SmartMove merchant account, το net ποσό μεταφέρεται στον carrier μέσω SEPA payout.

Καθώς το Viva δεν υποστηρίζει native split-at-capture σε όλες τις εκδόσεις, χρησιμοποιούμε ένα δευτερεύον "Sub-merchant" pattern:
1. SmartMove = master merchant
2. Κάθε carrier δηλώνεται ως sub-merchant με δικό του IBAN
3. Στο `captureCharge` ορίζεται `SubMerchantSourceCode` = carrier sub-account
4. Viva μεταφέρει αυτόματα στο carrier με 12% commission στο SmartMove

## B. AADE myDATA Integration

### Overview

Υποχρεωτικό από Φεβρουάριο 2026 (>€1M τζίρος) και Οκτώβριος 2026 (all). Χρησιμοποιούμε το REST API της AADE για να υποβάλλουμε τιμολόγια αυτόματα.

### Endpoint configuration

| Env | Base URL |
|---|---|
| Dev | `https://mydataapidev.aade.gr/myDATA/RequestDocs` |
| Production | `https://mydatapi.aade.gr/myDATA/RequestDocs` |

### src/lib/mydata/client.ts

```typescript
import { env } from "@/lib/env";

const BASE = env.MYDATA_ENV === "production"
  ? "https://mydatapi.aade.gr"
  : "https://mydataapidev.aade.gr";

export async function mydataFetch(path: string, init?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "aade-user-id":           env.MYDATA_USER_ID,
      "Ocp-Apim-Subscription-Key": env.MYDATA_SUBSCRIPTION_KEY,
      "Content-Type":           "application/xml",
      ...(init?.headers ?? {}),
    },
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`myDATA ${path} ${r.status}: ${body}`);
  }
  return r.text();
}

export const submitInvoice = (xml: string) =>
  mydataFetch("/myDATA/SendInvoices", { method: "POST", body: xml });

export const cancelInvoice = (mark: string) =>
  mydataFetch(`/myDATA/CancelInvoice?mark=${mark}`, { method: "POST" });
```

### Invoice builder (XML)

myDATA δέχεται ένα συγκεκριμένο XML schema (AADE_myDataXSD).

```typescript
// src/lib/mydata/invoice.builder.ts
import { create } from "xmlbuilder2";

export function buildInvoiceXml(opts: {
  series: string; number: string;
  issuerVat: string; issuerName: string;
  customerVat?: string; customerName: string; customerAddress: string;
  issueDate: Date;
  netAmountCents: number; vatAmountCents: number; totalAmountCents: number;
  vatCategory: number; // 1 = 24%, 2 = 13%, 3 = 6%
  invoiceType: string; // "1.1" = Τιμολόγιο πώλησης, "11.1" = ΑΛΠ
}) {
  const root = create({ version: "1.0", encoding: "UTF-8" })
    .ele("InvoicesDoc", { xmlns: "http://www.aade.gr/myDATA/invoice/v1.0" })
      .ele("invoice")
        .ele("issuer")
          .ele("vatNumber").txt(opts.issuerVat).up()
          .ele("country").txt("GR").up()
          .ele("branch").txt("0").up()
          .ele("name").txt(opts.issuerName).up()
        .up()
        .ele("counterpart")
          .ele("vatNumber").txt(opts.customerVat ?? "000000000").up()
          .ele("country").txt("GR").up()
          .ele("name").txt(opts.customerName).up()
          .ele("address")
            .ele("street").txt(opts.customerAddress.split(",")[0]).up()
            .ele("number").txt("0").up()
            .ele("city").txt(opts.customerAddress.split(",")[1]?.trim() ?? "").up()
          .up()
        .up()
        .ele("invoiceHeader")
          .ele("series").txt(opts.series).up()
          .ele("aa").txt(opts.number).up()
          .ele("issueDate").txt(opts.issueDate.toISOString().slice(0, 10)).up()
          .ele("invoiceType").txt(opts.invoiceType).up()
          .ele("currency").txt("EUR").up()
        .up()
        .ele("invoiceDetails")
          .ele("lineNumber").txt("1").up()
          .ele("netValue").txt((opts.netAmountCents / 100).toFixed(2)).up()
          .ele("vatCategory").txt(String(opts.vatCategory)).up()
          .ele("vatAmount").txt((opts.vatAmountCents / 100).toFixed(2)).up()
          .ele("incomeClassification")
            .ele("classificationType").txt("E3_561_003").up()
            .ele("classificationCategory").txt("category1_3").up()
            .ele("amount").txt((opts.netAmountCents / 100).toFixed(2)).up()
          .up()
        .up()
        .ele("invoiceSummary")
          .ele("totalNetValue").txt((opts.netAmountCents / 100).toFixed(2)).up()
          .ele("totalVatAmount").txt((opts.vatAmountCents / 100).toFixed(2)).up()
          .ele("totalWithheldAmount").txt("0.00").up()
          .ele("totalFeesAmount").txt("0.00").up()
          .ele("totalStampDutyAmount").txt("0.00").up()
          .ele("totalOtherTaxesAmount").txt("0.00").up()
          .ele("totalDeductionsAmount").txt("0.00").up()
          .ele("totalGrossValue").txt((opts.totalAmountCents / 100).toFixed(2)).up()
        .up()
      .up()
    .up();
  return root.end({ prettyPrint: true });
}
```

### Service: issue invoice when booking completes

```typescript
// src/server/services/invoice.service.ts
export async function issueInvoiceForBooking(bookingId: string) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true, carrier: true, moveRequest: true },
  });
  if (!booking) throw new Error("Booking not found");

  const vatRate = 0.24;
  const totalAmountCents = booking.finalPriceCents;
  const netAmountCents = Math.round(totalAmountCents / (1 + vatRate));
  const vatAmountCents = totalAmountCents - netAmountCents;

  // Generate next invoice number for carrier
  const lastInvoice = await db.invoice.findFirst({
    where: { carrierId: booking.carrierId },
    orderBy: { number: "desc" },
  });
  const nextNumber = String(Number(lastInvoice?.number ?? 0) + 1).padStart(6, "0");

  // Build & submit
  const xml = buildInvoiceXml({
    series: "Α",
    number: nextNumber,
    issuerVat: booking.carrier.vatNumber,
    issuerName: booking.carrier.legalName,
    customerVat: undefined, // ιδιώτης — προσωρινό
    customerName: booking.customer.name ?? "Πελάτης",
    customerAddress: booking.moveRequest.toAddress,
    issueDate: new Date(),
    netAmountCents,
    vatAmountCents,
    totalAmountCents,
    vatCategory: 1,
    invoiceType: "11.1", // ΑΛΠ — ιδιώτης
  });

  const responseText = await submitInvoice(xml);
  const mark = extractMark(responseText);

  return db.invoice.create({
    data: {
      bookingId, carrierId: booking.carrierId,
      issuerVat: booking.carrier.vatNumber, issuerName: booking.carrier.legalName,
      customerName: booking.customer.name ?? "Πελάτης",
      customerAddress: booking.moveRequest.toAddress,
      netAmountCents, vatAmountCents, totalAmountCents,
      vatRate, series: "Α", number: nextNumber,
      invoiceType: "11.1",
      mark, status: "ACCEPTED", issuedAt: new Date(),
    },
  });
}
```

### Retry strategy (BullMQ)

myDATA dev sandbox είναι unstable. Queue με exponential backoff:

```typescript
await invoiceQueue.add(
  "issue",
  { bookingId },
  { attempts: 5, backoff: { type: "exponential", delay: 30_000 } },
);
```
