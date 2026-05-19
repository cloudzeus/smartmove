import { env } from "@/lib/env";
import type { JobItem } from "@/components/scan/wizard-types";

export interface MoveRequestEmailParams {
  customerName: string;
  customerEmail: string;
  ref: string;
  fromAddress: string;
  toAddress: string;
  preferredDate: string; // already formatted Greek
  flexDays: number;
  shared: boolean;
  type: string;
  items: JobItem[];
  totalVolumeM3: number;
  itemsCount: number;
  fromFloor: number;
  toFloor: number;
  fromElevator: string;
  toElevator: string;
  crane: string;
  packing: boolean;
  truckAccess: string;
  notes?: string;
  estimatedPriceMin?: number;
  estimatedPriceMax?: number;
  dashboardUrl?: string;
}

const BRAND_BLUE = "#2563EB";
const BRAND_BLUE_DEEP = "#1E40AF";
const BRAND_BLUE_LIGHT = "#EFF6FF";
const BRAND_RED = "#EF4444";
const BG = "#F8FAFC";
const TEXT = "#0F172A";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";

export function renderMoveRequestPublishedEmail(
  p: MoveRequestEmailParams,
): { subject: string; html: string; text: string } {
  const dashUrl = p.dashboardUrl ?? `${env.appUrl()}/dashboard/requests`;
  const subject = `Το αίτημά σου δημοσιεύτηκε — SmartMove #${p.ref}`;
  const html = renderHtml(p, dashUrl);
  const text = renderText(p, dashUrl);
  return { subject, html, text };
}

function renderHtml(p: MoveRequestEmailParams, dashUrl: string): string {
  const itemsRows = p.items
    .slice(0, 30)
    .map(
      (it) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid ${BORDER};font-size:13px;color:${TEXT};">
            ${escape(it.name)}
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid ${BORDER};font-size:13px;color:${MUTED};text-align:center;width:60px;">
            ${it.quantity}×
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid ${BORDER};font-size:13px;color:${TEXT};text-align:right;width:90px;white-space:nowrap;">
            <strong>${(it.volume_m3 * it.quantity).toFixed(2)} m³</strong>
          </td>
        </tr>
      `,
    )
    .join("");
  const moreItems =
    p.items.length > 30
      ? `<tr><td colspan="3" style="padding:10px 12px;font-size:12px;color:${MUTED};text-align:center;">+ ${p.items.length - 30} ακόμα αντικείμενα</td></tr>`
      : "";

  const estimateBlock =
    p.estimatedPriceMin != null && p.estimatedPriceMax != null
      ? `
        <tr>
          <td style="padding:18px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND_BLUE_LIGHT};border-radius:12px;padding:16px;">
              <tr>
                <td style="font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">
                  Εκτιμώμενο εύρος αγοράς
                </td>
              </tr>
              <tr>
                <td style="font-size:24px;font-weight:800;color:${BRAND_BLUE_DEEP};font-family:Manrope,Inter,Arial,sans-serif;">
                  ${p.estimatedPriceMin}€ – ${p.estimatedPriceMax}€
                </td>
              </tr>
              <tr>
                <td style="font-size:12px;color:${MUTED};padding-top:4px;">
                  Οι τελικές προσφορές διαμορφώνονται από τους μεταφορείς.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `
      : "";

  return `<!DOCTYPE html>
<html lang="el">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${escape(p.ref)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:Inter,Arial,Helvetica,sans-serif;color:${TEXT};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;border:1px solid ${BORDER};">
          <!-- Header -->
          <tr>
            <td style="padding:24px 28px;border-bottom:1px solid ${BORDER};background:linear-gradient(135deg, ${BRAND_BLUE_LIGHT} 0%, #fff 100%);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-family:Manrope,Inter,Arial,sans-serif;font-size:22px;font-weight:800;letter-spacing:-0.5px;">
                      <span style="color:${BRAND_BLUE};">Smart</span><span style="color:${TEXT};">Move</span><span style="color:${BRAND_RED};">.</span>
                    </span>
                  </td>
                  <td align="right">
                    <span style="font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:1px;">
                      Αναφορά #${escape(p.ref)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="padding:32px 28px 8px;">
              <div style="display:inline-block;background:#DCFCE7;color:#15803D;padding:4px 10px;border-radius:9999px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">
                ✓ Δημοσιεύτηκε
              </div>
              <h1 style="margin:14px 0 8px;font-family:Manrope,Inter,Arial,sans-serif;font-size:26px;font-weight:800;color:${TEXT};letter-spacing:-0.5px;line-height:1.15;">
                Γεια σου ${escape(firstName(p.customerName))},<br>
                το αίτημα μεταφοράς σου είναι online.
              </h1>
              <p style="margin:0;font-size:15px;color:${MUTED};line-height:1.6;">
                Επαληθευμένοι μεταφορείς της περιοχής σου ενημερώνονται. Οι πρώτες
                προσφορές φτάνουν συνήθως μέσα σε <strong style="color:${TEXT};">30–60 λεπτά</strong>.
              </p>
            </td>
          </tr>

          <!-- Route card -->
          <tr>
            <td style="padding:24px 28px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER};border-radius:12px;background:${BG};">
                <tr>
                  <td style="padding:16px;">
                    <p style="margin:0 0 6px;font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:1px;font-weight:700;">Διαδρομή</p>
                    <p style="margin:0;font-size:16px;font-weight:700;color:${TEXT};line-height:1.4;">
                      <span style="color:${BRAND_BLUE};">●</span> ${escape(p.fromAddress)}<br>
                      <span style="color:${BRAND_RED};">●</span> ${escape(p.toAddress)}
                    </p>
                    <p style="margin:10px 0 0;font-size:13px;color:${MUTED};">
                      📅 ${escape(p.preferredDate)}${p.flexDays > 0 ? ` · ±${p.flexDays} ημέρες` : ""}${p.shared ? " · 🔄 Shared Load" : ""}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Volume highlight -->
          <tr>
            <td style="padding:18px 28px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:14px 16px;background:${BRAND_BLUE_LIGHT};border-radius:12px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <p style="margin:0;font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:1px;font-weight:700;">Συνολικός όγκος</p>
                          <p style="margin:2px 0 0;font-family:Manrope,Inter,Arial,sans-serif;font-size:28px;font-weight:800;color:${BRAND_BLUE_DEEP};">
                            ${p.totalVolumeM3.toFixed(2)} m³
                          </p>
                        </td>
                        <td align="right" style="vertical-align:middle;">
                          <p style="margin:0;font-size:13px;color:${MUTED};">
                            <strong style="color:${TEXT};font-size:15px;">${p.itemsCount}</strong> αντικείμενα
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Items table -->
          <tr>
            <td style="padding:18px 28px 0;">
              <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:${TEXT};">Λίστα αντικειμένων</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER};border-radius:12px;overflow:hidden;">
                ${itemsRows}
                ${moreItems}
              </table>
            </td>
          </tr>

          <!-- Property details -->
          <tr>
            <td style="padding:18px 28px 0;">
              <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:${TEXT};">Στοιχεία χώρου</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER};border-radius:12px;">
                ${row("Όροφος αναχώρησης", floorLabel(p.fromFloor))}
                ${row("Ασανσέρ αναχώρησης", elevatorLabel(p.fromElevator))}
                ${row("Όροφος προορισμού", floorLabel(p.toFloor))}
                ${row("Ασανσέρ προορισμού", elevatorLabel(p.toElevator))}
                ${row("Γερανός", craneLabel(p.crane))}
                ${row("Αμπαλάζ", p.packing ? "Ναι" : "Όχι")}
                ${row("Πρόσβαση φορτηγού", truckLabel(p.truckAccess), true)}
              </table>
              ${
                p.notes
                  ? `<p style="margin:14px 0 0;padding:12px 14px;background:${BG};border:1px solid ${BORDER};border-radius:10px;font-size:13px;color:${TEXT};line-height:1.5;"><strong>Σημειώσεις:</strong> ${escape(p.notes)}</p>`
                  : ""
              }
            </td>
          </tr>

          ${estimateBlock}

          <!-- CTA -->
          <tr>
            <td style="padding:18px 28px 24px;text-align:center;">
              <a href="${escape(dashUrl)}" style="display:inline-block;background:${BRAND_BLUE};color:#fff;padding:14px 28px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;font-family:Inter,Arial,sans-serif;">
                Δες το αίτημά σου →
              </a>
              <p style="margin:14px 0 0;font-size:12px;color:${MUTED};">
                Θα ειδοποιηθείς με email μόλις φτάσουν οι πρώτες προσφορές.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 28px;border-top:1px solid ${BORDER};background:${BG};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:11px;color:${MUTED};line-height:1.6;">
                    SmartMove — Η έξυπνη κίνηση για κάθε μεταφορά<br>
                    Τηλέφωνο υποστήριξης: <a href="tel:+302103000450" style="color:${BRAND_BLUE};text-decoration:none;">210 3000 450</a> · Δευ–Κυρ 08:00–22:00<br>
                    Λάβατε αυτό το email επειδή δημοσιεύσατε αίτημα μεταφοράς στο SmartMove.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderText(p: MoveRequestEmailParams, dashUrl: string): string {
  const items = p.items
    .slice(0, 30)
    .map((i) => `  • ${i.quantity}× ${i.name} — ${(i.volume_m3 * i.quantity).toFixed(2)} m³`)
    .join("\n");
  return [
    `SmartMove — Αναφορά #${p.ref}`,
    "",
    `Γεια σου ${firstName(p.customerName)},`,
    "",
    `Το αίτημα μεταφοράς σου είναι online. Επαληθευμένοι μεταφορείς ενημερώνονται και οι πρώτες προσφορές φτάνουν συνήθως σε 30-60 λεπτά.`,
    "",
    `ΔΙΑΔΡΟΜΗ:`,
    `  Από: ${p.fromAddress}`,
    `  Προς: ${p.toAddress}`,
    `  Πότε: ${p.preferredDate}${p.flexDays ? ` (±${p.flexDays} ημέρες)` : ""}`,
    p.shared ? `  Shared Load: ναι` : "",
    "",
    `ΟΓΚΟΣ: ${p.totalVolumeM3.toFixed(2)} m³ · ${p.itemsCount} αντικείμενα`,
    "",
    `ΑΝΤΙΚΕΙΜΕΝΑ:`,
    items,
    p.items.length > 30 ? `  + ${p.items.length - 30} ακόμα` : "",
    "",
    `ΣΤΟΙΧΕΙΑ ΧΩΡΟΥ:`,
    `  Όροφος αναχώρησης: ${floorLabel(p.fromFloor)} (ασανσέρ: ${elevatorLabel(p.fromElevator)})`,
    `  Όροφος προορισμού: ${floorLabel(p.toFloor)} (ασανσέρ: ${elevatorLabel(p.toElevator)})`,
    `  Γερανός: ${craneLabel(p.crane)}`,
    `  Αμπαλάζ: ${p.packing ? "Ναι" : "Όχι"}`,
    `  Πρόσβαση φορτηγού: ${truckLabel(p.truckAccess)}`,
    p.notes ? `  Σημειώσεις: ${p.notes}` : "",
    p.estimatedPriceMin && p.estimatedPriceMax
      ? `\nΕΚΤΙΜΩΜΕΝΟ ΕΥΡΟΣ: ${p.estimatedPriceMin}€ – ${p.estimatedPriceMax}€`
      : "",
    "",
    `Δες το αίτημά σου: ${dashUrl}`,
    "",
    `Τηλέφωνο υποστήριξης: 210 3000 450 (Δευ–Κυρ 08:00–22:00)`,
  ]
    .filter(Boolean)
    .join("\n");
}

function row(label: string, value: string, last = false): string {
  const border = last ? "" : `border-bottom:1px solid ${BORDER};`;
  return `
    <tr>
      <td style="padding:10px 14px;${border}font-size:12px;color:${MUTED};width:55%;">${escape(label)}</td>
      <td style="padding:10px 14px;${border}font-size:13px;color:${TEXT};font-weight:600;text-align:right;">${escape(value)}</td>
    </tr>
  `;
}

function escape(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function firstName(full: string): string {
  return full.split(/\s+/)[0] ?? full;
}

function floorLabel(n: number): string {
  if (n < 0) return `${Math.abs(n)}ο υπόγειο`;
  if (n === 0) return "Ισόγειο";
  if (n === 1) return "1ος όροφος";
  return `${n}ος όροφος`;
}

function elevatorLabel(v: string): string {
  switch (v) {
    case "NONE":
    case "none":
      return "Όχι";
    case "SMALL":
    case "small":
      return "Μικρό";
    case "MEDIUM":
    case "medium":
      return "Μεσαίο";
    case "LARGE":
    case "large":
      return "Μεγάλο";
    default:
      return v;
  }
}

function craneLabel(v: string): string {
  switch (v) {
    case "NONE":
    case "none":
      return "Όχι";
    case "SOME":
    case "some":
      return "Ναι, για κάποια αντικείμενα";
    case "ALL":
    case "all":
      return "Ναι, για όλο το φορτίο";
    default:
      return v;
  }
}

function truckLabel(v: string): string {
  switch (v) {
    case "EASY":
    case "easy":
      return "Καλή πρόσβαση";
    case "LIMITED":
    case "limited":
      return "Περιορισμένη";
    case "NARROW":
    case "narrow":
      return "Στενό δρομάκι / πεζόδρομος";
    default:
      return v;
  }
}
