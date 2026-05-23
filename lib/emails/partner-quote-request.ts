interface RenderArgs {
  partnerName: string;
  carrierName: string;
  service: string;
  notes?: string | null;
  moveSummary: {
    fromAddress: string;
    toAddress: string;
    preferredDate?: string | null;
    itemsCount?: number | null;
    volumeM3?: number | null;
    estimatedMinutes?: number | null;
  };
  /** Specific stop address where the partner's service is needed. When
   *  present, this is shown prominently and the from→to becomes secondary
   *  context — partner may operate only in one city. */
  workLocation?: {
    address: string;
    stopType?: "PICKUP" | "DELIVERY" | "INTERMEDIATE" | null;
    label?: string | null;
    /** "1 από 3", for multi-stop context. */
    sequenceLabel?: string | null;
  } | null;
  quoteUrl: string;
  expiresAt?: Date | null;
}

const SERVICE_LABEL: Record<string, string> = {
  PACKING: "Πακετάρισμα / αμπαλάζ",
  CRANE: "Γερανός",
  STORAGE: "Αποθήκευση",
  HANDYMAN: "Τεχνίτης",
  ELECTRICIAN: "Ηλεκτρολόγος",
  CARPENTER: "Ξυλουργός",
  OTHER: "Άλλη υπηρεσία",
};

export function renderPartnerQuoteRequestEmail(args: RenderArgs) {
  const serviceLabel = SERVICE_LABEL[args.service] ?? args.service;
  // If we know the specific work location, lead with it in the subject so a
  // crane partner in Athens immediately sees "Αθήνα" instead of "Athens →
  // Thessaloniki". Falls back to the legacy from→to route for old callers.
  const subjectLocation = args.workLocation?.address ?? `${args.moveSummary.fromAddress} → ${args.moveSummary.toAddress}`;
  const subject = `Αίτημα προσφοράς · ${serviceLabel} · ${subjectLocation}`;
  const stopTypeLabel =
    args.workLocation?.stopType === "PICKUP"   ? "Παραλαβή" :
    args.workLocation?.stopType === "DELIVERY" ? "Παράδοση" :
    args.workLocation?.stopType === "INTERMEDIATE" ? "Ενδιάμεση στάση" :
    "Σημείο εργασίας";
  const itemLine =
    args.moveSummary.itemsCount != null
      ? `${args.moveSummary.itemsCount} τεμ${args.moveSummary.volumeM3 != null ? ` · ${args.moveSummary.volumeM3.toFixed(1)} m³` : ""}`
      : "";

  const durationLine =
    args.moveSummary.estimatedMinutes != null
      ? `${(args.moveSummary.estimatedMinutes / 60).toFixed(1)}h εκτιμώμενη διάρκεια`
      : "";

  const text = [
    `Γεια σου ${args.partnerName},`,
    "",
    `Η εταιρεία ${args.carrierName} χρειάζεται προσφορά σου για: ${serviceLabel}.`,
    "",
    args.workLocation
      ? [
          `📍 ${stopTypeLabel}${args.workLocation.sequenceLabel ? ` (${args.workLocation.sequenceLabel})` : ""}:`,
          `  ${args.workLocation.address}`,
          args.workLocation.label ? `  (${args.workLocation.label})` : "",
          "",
          "Συνολική διαδρομή μεταφοράς (για context):",
          `  ${args.moveSummary.fromAddress} → ${args.moveSummary.toAddress}`,
        ].filter(Boolean).join("\n")
      : [
          "Στοιχεία μεταφοράς:",
          `  Παραλαβή:  ${args.moveSummary.fromAddress}`,
          `  Παράδοση:  ${args.moveSummary.toAddress}`,
        ].join("\n"),
    args.moveSummary.preferredDate
      ? `  Ημερομηνία: ${args.moveSummary.preferredDate}`
      : "",
    itemLine ? `  ${itemLine}` : "",
    durationLine ? `  Διάρκεια: ${durationLine}` : "",
    args.notes ? `\nΣημείωση: ${args.notes}` : "",
    "",
    "Στείλε προσφορά εδώ:",
    args.quoteUrl,
    args.expiresAt
      ? `\nΛήγει: ${args.expiresAt.toLocaleString("el-GR")}`
      : "",
    "",
    "— SmartMove",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f7f9fc; margin: 0; padding: 24px; color: #0f172a; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 28px; max-width: 560px; margin: 0 auto; box-shadow: 0 1px 3px rgba(15,23,42,0.08); }
    .eyebrow { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: #2563eb; margin-bottom: 8px; }
    h1 { font-size: 22px; margin: 0 0 12px; }
    .pill { display: inline-block; padding: 4px 10px; border-radius: 999px; background: #dbeafe; color: #1e40af; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
    .grid { display: grid; gap: 8px; margin: 20px 0; padding: 16px; background: #f8fafc; border-radius: 12px; }
    .row { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; }
    .label { color: #64748b; font-weight: 600; }
    .value { color: #0f172a; font-weight: 600; text-align: right; }
    .notes { background: #fefce8; border: 1px solid #fde047; border-radius: 8px; padding: 12px; font-size: 13px; color: #713f12; margin-top: 12px; }
    .btn { display: inline-block; padding: 14px 24px; background: #2563eb; color: #fff !important; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px; margin-top: 20px; }
    .footer { color: #94a3b8; font-size: 11px; margin-top: 20px; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="eyebrow">SmartMove · Αίτημα προσφοράς</div>
    <h1>Γεια σου ${escapeHtml(args.partnerName)},</h1>
    <p>Η εταιρεία <strong>${escapeHtml(args.carrierName)}</strong> χρειάζεται προσφορά σου για:</p>
    <p><span class="pill">${escapeHtml(serviceLabel)}</span></p>

    ${
      args.workLocation
        ? `
    <div style="background:#fef3c7;border:2px solid #fbbf24;border-radius:12px;padding:14px 16px;margin:20px 0;">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#92400e;margin-bottom:6px;">📍 ${escapeHtml(stopTypeLabel)}${args.workLocation.sequenceLabel ? ` · ${escapeHtml(args.workLocation.sequenceLabel)}` : ""}</div>
      <div style="font-size:16px;font-weight:700;color:#78350f;">${escapeHtml(args.workLocation.address)}</div>
      ${args.workLocation.label ? `<div style="font-size:12px;color:#92400e;margin-top:2px;">${escapeHtml(args.workLocation.label)}</div>` : ""}
      <div style="font-size:11px;color:#a16207;margin-top:8px;font-style:italic;">⚠ Η εργασία αφορά αποκλειστικά αυτό το σημείο.</div>
    </div>
    `
        : ""
    }
    <div class="grid">
      ${
        args.workLocation
          ? `<div class="row"><span class="label">Συνολική διαδρομή</span><span class="value" style="font-size:12px;color:#64748b;">${escapeHtml(args.moveSummary.fromAddress)} → ${escapeHtml(args.moveSummary.toAddress)}</span></div>`
          : `
        <div class="row">
          <span class="label">Παραλαβή</span>
          <span class="value">${escapeHtml(args.moveSummary.fromAddress)}</span>
        </div>
        <div class="row">
          <span class="label">Παράδοση</span>
          <span class="value">${escapeHtml(args.moveSummary.toAddress)}</span>
        </div>
      `
      }
      ${
        args.moveSummary.preferredDate
          ? `<div class="row"><span class="label">Ημερομηνία</span><span class="value">${escapeHtml(args.moveSummary.preferredDate)}</span></div>`
          : ""
      }
      ${
        itemLine
          ? `<div class="row"><span class="label">Φορτίο</span><span class="value">${escapeHtml(itemLine)}</span></div>`
          : ""
      }
      ${
        durationLine
          ? `<div class="row"><span class="label">Διάρκεια</span><span class="value">${escapeHtml(durationLine)}</span></div>`
          : ""
      }
    </div>

    ${args.notes ? `<div class="notes"><strong>Σημείωση:</strong> ${escapeHtml(args.notes)}</div>` : ""}

    <p>Πάτα παρακάτω για να στείλεις την προσφορά σου με την τιμή σου και τυχόν σημειώσεις:</p>
    <a class="btn" href="${args.quoteUrl}">Στείλε προσφορά</a>

    ${
      args.expiresAt
        ? `<p style="font-size: 11px; color: #94a3b8; margin-top: 16px;">Λήγει: ${args.expiresAt.toLocaleString("el-GR")}</p>`
        : ""
    }
    <div class="footer">SmartMove · Διαχείριση μεταφορών</div>
  </div>
</body>
</html>`.trim();

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
