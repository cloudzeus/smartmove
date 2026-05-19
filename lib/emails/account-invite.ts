import { env } from "@/lib/env";

export interface AccountInviteParams {
  name: string;
  email: string;
  tempPassword: string;
  /** "employee" sends them to /admin, default lands them at /dashboard */
  variant?: "employee" | "customer" | "carrier";
  signInUrl?: string;
  /** Optional: name of the admin/inviter to humanize the message */
  invitedByName?: string;
}

const BRAND_BLUE = "#2563EB";
const BRAND_BLUE_DEEP = "#1E40AF";
const BRAND_BLUE_LIGHT = "#EFF6FF";
const BRAND_RED = "#EF4444";
const BG = "#F8FAFC";
const TEXT = "#0F172A";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";

export function renderAccountInviteEmail(
  p: AccountInviteParams,
): { subject: string; html: string; text: string } {
  const url = p.signInUrl ?? `${env.appUrl()}/sign-in`;
  const variant = p.variant ?? "customer";
  const intro =
    variant === "employee"
      ? "Σου δημιουργήθηκε λογαριασμός υπαλλήλου SmartMove."
      : variant === "carrier"
        ? "Σου δημιουργήθηκε λογαριασμός μεταφορέα SmartMove."
        : "Σου δημιουργήθηκε λογαριασμός πελάτη SmartMove.";
  const subject = "Καλωσήρθες στο SmartMove — ο προσωρινός σου κωδικός";
  const html = renderHtml(p, url, intro);
  const text = renderText(p, url, intro);
  return { subject, html, text };
}

function renderHtml(p: AccountInviteParams, url: string, intro: string): string {
  return `<!DOCTYPE html>
<html lang="el">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SmartMove</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:Inter,Arial,Helvetica,sans-serif;color:${TEXT};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;border:1px solid ${BORDER};">
          <tr>
            <td style="padding:24px 28px;border-bottom:1px solid ${BORDER};background:linear-gradient(135deg, ${BRAND_BLUE_LIGHT} 0%, #fff 100%);">
              <span style="font-family:Manrope,Inter,Arial,sans-serif;font-size:22px;font-weight:800;letter-spacing:-0.5px;">
                <span style="color:${BRAND_BLUE};">Smart</span><span style="color:${TEXT};">Move</span><span style="color:${BRAND_RED};">.</span>
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px 8px;">
              <h1 style="margin:0 0 8px;font-family:Manrope,Inter,Arial,sans-serif;font-size:24px;font-weight:800;color:${TEXT};letter-spacing:-0.5px;">
                Γεια σου ${escape(firstName(p.name))},
              </h1>
              <p style="margin:0;font-size:15px;color:${MUTED};line-height:1.6;">
                ${escape(intro)}${p.invitedByName ? ` Σε προσκάλεσε ο/η <strong style="color:${TEXT};">${escape(p.invitedByName)}</strong>.` : ""}
                Χρησιμοποίησε τα παρακάτω στοιχεία για την πρώτη σου σύνδεση.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:22px 28px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};border:1px solid ${BORDER};border-radius:12px;">
                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid ${BORDER};">
                    <p style="margin:0 0 4px;font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:1px;font-weight:700;">Email</p>
                    <p style="margin:0;font-size:15px;font-weight:600;color:${TEXT};font-family:Menlo,Consolas,monospace;">${escape(p.email)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0 0 4px;font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:1px;font-weight:700;">Προσωρινός κωδικός</p>
                    <p style="margin:0;font-size:20px;font-weight:800;color:${BRAND_BLUE_DEEP};font-family:Menlo,Consolas,monospace;letter-spacing:2px;">${escape(p.tempPassword)}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:12px 0 0;font-size:12px;color:${MUTED};line-height:1.6;">
                ⚠️ Για λόγους ασφαλείας, άλλαξε αμέσως τον κωδικό από τις ρυθμίσεις του λογαριασμού σου μετά την πρώτη σύνδεση.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:22px 28px 28px;text-align:center;">
              <a href="${escape(url)}" style="display:inline-block;background:${BRAND_BLUE};color:#fff;padding:14px 28px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;">
                Συνδέσου τώρα →
              </a>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 28px;border-top:1px solid ${BORDER};background:${BG};">
              <p style="margin:0;font-size:11px;color:${MUTED};line-height:1.6;">
                SmartMove — Η έξυπνη κίνηση για κάθε μεταφορά<br>
                Αν δεν περίμενες αυτό το email, αγνόησέ το ή επικοινώνησε στο <a href="tel:+302103000450" style="color:${BRAND_BLUE};text-decoration:none;">210 3000 450</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderText(p: AccountInviteParams, url: string, intro: string): string {
  return [
    `SmartMove — Καλωσήρθες`,
    "",
    `Γεια σου ${firstName(p.name)},`,
    "",
    intro,
    p.invitedByName ? `Σε προσκάλεσε ο/η ${p.invitedByName}.` : "",
    "",
    `Στοιχεία πρώτης σύνδεσης:`,
    `  Email: ${p.email}`,
    `  Προσωρινός κωδικός: ${p.tempPassword}`,
    "",
    `Άλλαξε τον κωδικό αμέσως μετά την πρώτη σύνδεση από τις ρυθμίσεις λογαριασμού.`,
    "",
    `Συνδέσου: ${url}`,
    "",
    `Υποστήριξη: 210 3000 450`,
  ]
    .filter(Boolean)
    .join("\n");
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
