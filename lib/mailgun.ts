import { env, flags } from "./env";

export interface MailgunAttachment {
  filename: string;
  /** Binary payload — Node Buffer */
  content: Buffer;
  /** MIME type, e.g. "application/pdf". */
  contentType?: string;
}

export interface MailgunMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: string[];
  attachments?: MailgunAttachment[];
}

export interface MailgunResult {
  ok: boolean;
  id?: string;
  error?: string;
}

/**
 * Send a transactional email through the Mailgun HTTP API.
 *
 * Endpoint convention: `MAILGUN_ENDPOINT` is the full base URL up to (and
 * including) the domain, e.g. `https://api.eu.mailgun.net/v3/mg.smartmove.gr`.
 * We append `/messages` ourselves so the env stays domain-scoped.
 */
export async function sendMail(msg: MailgunMessage): Promise<MailgunResult> {
  if (!flags.hasMailgun()) {
    console.warn("[mailgun] not configured — skipping send", {
      to: msg.to,
      subject: msg.subject,
    });
    return { ok: false, error: "mailgun_not_configured" };
  }

  const endpoint = env.mailgunEndpoint()!.replace(/\/+$/, "");
  const url = endpoint.endsWith("/messages") ? endpoint : `${endpoint}/messages`;
  const apiKey = env.mailgunApiKey()!;
  const sender = env.mailgunSender()!;

  // Dev/staging override — when MAILGUN_REDIRECT_TO is set, every outgoing
  // email is delivered there instead of the real recipient. Original
  // recipients are added to the subject + X-Original-To header so you can
  // still trace who the message was meant for.
  const redirectTo = process.env.MAILGUN_REDIRECT_TO?.trim();
  const originalRecipients = Array.isArray(msg.to) ? msg.to : [msg.to];
  const effectiveRecipients = redirectTo ? [redirectTo] : originalRecipients;
  const subject = redirectTo
    ? `[→ ${originalRecipients.join(", ")}] ${msg.subject}`
    : msg.subject;

  const body = new FormData();
  body.append("from", `SmartMove <${sender}>`);
  for (const recipient of effectiveRecipients) {
    body.append("to", recipient);
  }
  if (redirectTo) {
    body.append("h:X-Original-To", originalRecipients.join(", "));
  }
  body.append("subject", subject);
  body.append("html", msg.html);
  if (msg.text) body.append("text", msg.text);
  if (msg.replyTo) body.append("h:Reply-To", msg.replyTo);
  for (const tag of msg.tags ?? []) body.append("o:tag", tag);
  for (const att of msg.attachments ?? []) {
    // Copy into a fresh Uint8Array so the underlying buffer is plain ArrayBuffer
    // (not SharedArrayBuffer/ArrayBufferLike), which Blob requires.
    const arr = new Uint8Array(att.content.byteLength);
    arr.set(att.content);
    const blob = new Blob([arr], {
      type: att.contentType ?? "application/octet-stream",
    });
    body.append("attachment", blob, att.filename);
  }

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
      },
      body,
    });

    if (!r.ok) {
      const text = await r.text();
      console.error(`[mailgun] ${r.status}: ${text.slice(0, 300)}`);
      return { ok: false, error: `mailgun_${r.status}` };
    }

    const data = (await r.json()) as { id?: string; message?: string };
    return { ok: true, id: data.id };
  } catch (e) {
    console.error("[mailgun] fetch failed:", e);
    return { ok: false, error: "fetch_failed" };
  }
}
