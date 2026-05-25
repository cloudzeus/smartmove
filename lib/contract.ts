import { promises as fs } from "node:fs";
import path from "node:path";

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  HeightRule,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import PDFDocument from "pdfkit";

import { loadInterFonts } from "./contract-fonts";

// ---------------- Types ----------------

export interface ContractItem {
  name: string;
  quantity: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  volume_m3: number;
  photoUrl?: string | null;
}

export interface ContractData {
  ref: string;
  generatedAt: Date;
  customer: {
    name: string;
    email: string | null;
    phone: string | null;
    afm?: string | null;
    address?: string | null;
  };
  carrier: {
    legalName: string;
    commercialName: string | null;
    afm: string;
    doy: string | null;
    address: string | null;
    email: string | null;
    phone: string | null;
  };
  request: {
    id: string;
    fromAddress: string;
    toAddress: string;
    itemsCount: number;
    volumeM3: number;
    typeLabel: string;
  };
  offer: {
    priceCents: number;
    estimatedDays: number | null;
    notes: string | null;
  };
  acceptedSlot: Date;
  items: ContractItem[];
}

// ---------------- Brand tokens ----------------

const BRAND = {
  blue: "2563EB",
  blueDeep: "1D4ED8",
  blueLight: "EFF6FF",
  red: "DC2626",
  foreground: "0F172A",
  muted: "5B6B82",
  border: "E2E8F0",
  surface: "F8FAFC",
  emerald: "059669",
  emeraldBg: "ECFDF5",
};

const STORE_DIR = path.join(process.cwd(), "public", "contracts");

// ---------------- Formatters ----------------

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("el-GR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);

const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat("el-GR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

const fmtEur = (cents: number) =>
  new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);

// ---------------- Photo fetcher ----------------

interface FetchedPhoto {
  url: string;
  buffer: Buffer;
  mime: "image/jpeg" | "image/png";
}

async function fetchPhotos(items: ContractItem[]): Promise<Map<string, FetchedPhoto>> {
  const map = new Map<string, FetchedPhoto>();
  const urls = items
    .map((i) => i.photoUrl)
    .filter((u): u is string => !!u && (u.startsWith("http") || u.startsWith("/")));
  const unique = Array.from(new Set(urls));

  await Promise.all(
    unique.map(async (url) => {
      try {
        let buffer: Buffer;
        let mime: "image/jpeg" | "image/png" = "image/jpeg";

        if (url.startsWith("/")) {
          // Local public path
          buffer = await fs.readFile(path.join(process.cwd(), "public", url));
        } else {
          const ac = new AbortController();
          const t = setTimeout(() => ac.abort(), 5000);
          const res = await fetch(url, { signal: ac.signal });
          clearTimeout(t);
          if (!res.ok) return;
          const ct = res.headers.get("content-type") ?? "";
          if (!ct.startsWith("image/")) return;
          if (ct.includes("png")) mime = "image/png";
          buffer = Buffer.from(await res.arrayBuffer());
        }
        map.set(url, { url, buffer, mime });
      } catch {
        // Silently skip unreachable photos
      }
    }),
  );

  return map;
}

// ---------------- Shared content blocks ----------------

interface Block {
  heading: string;
  rows: Array<[label: string, value: string]>;
}

interface Term {
  title: string;
  body: string;
}

function buildContent(d: ContractData) {
  const partyA: Block = {
    heading: "ΠΕΛΑΤΗΣ (Α)",
    rows: [
      ["Ονοματεπώνυμο", d.customer.name],
      ["Email", d.customer.email ?? "—"],
      ["Τηλέφωνο", d.customer.phone ?? "—"],
      ...(d.customer.afm ? [["ΑΦΜ", d.customer.afm]] : []),
      ...(d.customer.address ? [["Διεύθυνση", d.customer.address]] : []),
    ] as [string, string][],
  };

  const partyB: Block = {
    heading: "ΜΕΤΑΦΟΡΕΑΣ (Β)",
    rows: [
      ["Επωνυμία", d.carrier.legalName],
      ...(d.carrier.commercialName
        ? [["Διακριτικός τίτλος", d.carrier.commercialName]]
        : []),
      ["ΑΦΜ", d.carrier.afm],
      ["ΔΟΥ", d.carrier.doy ?? "—"],
      ["Διεύθυνση", d.carrier.address ?? "—"],
      ["Email", d.carrier.email ?? "—"],
      ["Τηλέφωνο", d.carrier.phone ?? "—"],
    ] as [string, string][],
  };

  const subject: Block = {
    heading: "ΑΝΤΙΚΕΙΜΕΝΟ ΜΕΤΑΦΟΡΑΣ",
    rows: [
      ["Κωδικός αιτήματος", `#${d.request.id.slice(-8).toUpperCase()}`],
      ["Διεύθυνση παραλαβής", d.request.fromAddress],
      ["Διεύθυνση παράδοσης", d.request.toAddress],
      ["Τύπος μεταφοράς", d.request.typeLabel],
      [
        "Φορτίο",
        `${d.request.itemsCount} τεμάχια · ${d.request.volumeM3.toFixed(2)} m³`,
      ],
      ["Ημερομηνία & ώρα", fmtDateTime(d.acceptedSlot)],
      ...(d.offer.estimatedDays
        ? [["Εκτιμώμενη διάρκεια", `${d.offer.estimatedDays} ημέρα/ες`]]
        : []),
      ["Συμφωνηθέν τίμημα", fmtEur(d.offer.priceCents)],
    ] as [string, string][],
  };

  const terms: Term[] = [
    {
      title: "1. Αντικείμενο της συμφωνίας",
      body: "Με την παρούσα συμφωνία, ο Μεταφορέας (Β) αναλαμβάνει για λογαριασμό του Πελάτη (Α) την μεταφορά των ανωτέρω αντικειμένων από την διεύθυνση παραλαβής στην διεύθυνση παράδοσης, την συμφωνημένη ημερομηνία και ώρα.",
    },
    {
      title: "2. Τίμημα και όροι πληρωμής",
      body: `Το συμφωνηθέν τίμημα ανέρχεται στο ποσό των ${fmtEur(d.offer.priceCents)}. Η πληρωμή πραγματοποιείται κατά τα ειδικότερα οριζόμενα μεταξύ των μερών, με την παράδοση των αντικειμένων ή σύμφωνα με την πολιτική του SmartMove.`,
    },
    {
      title: "3. Υποχρεώσεις μεταφορέα",
      body: "Ο Μεταφορέας αναλαμβάνει την υποχρέωση να εκτελέσει τη μεταφορά με επιμέλεια, ευθύνη και τα αναγκαία μέσα, σύμφωνα με τα ηθικά πρότυπα του κλάδου και την κείμενη νομοθεσία. Φέρει την ευθύνη για φθορές ή απώλειες κατά τη διάρκεια της μεταφοράς εφόσον προκύψουν από δική του υπαιτιότητα.",
    },
    {
      title: "4. Υποχρεώσεις πελάτη",
      body: "Ο Πελάτης δεσμεύεται να παράσχει ορθές πληροφορίες, να διασφαλίσει την πρόσβαση στους χώρους παραλαβής και παράδοσης κατά τη συμφωνημένη ώρα και να καταβάλει το τίμημα σύμφωνα με τους όρους της συμφωνίας.",
    },
    {
      title: "5. Ακύρωση",
      body: "Ακύρωση από τον Πελάτη έως 48 ώρες πριν την προγραμματισμένη ώρα παραλαβής είναι δωρεάν. Μετά από αυτή τη χρονική στιγμή, ενδέχεται να χρεωθεί τέλος ακύρωσης σύμφωνα με την πολιτική του SmartMove. Ο Μεταφορέας οφείλει επαρκή ειδοποίηση σε περίπτωση δικής του ακύρωσης.",
    },
    {
      title: "6. Ευθύνη πλατφόρμας",
      body: "Η πλατφόρμα SmartMove λειτουργεί ως διαμεσολαβητής για την σύναψη της παρούσας συμφωνίας. Δεν αποτελεί συμβαλλόμενο μέρος και δεν φέρει ευθύνη για την εκτέλεση της μεταφοράς, η οποία αφορά αποκλειστικά τα δύο μέρη (Α) και (Β).",
    },
    {
      title: "7. Επίλυση διαφορών",
      body: "Για κάθε διαφορά που ενδέχεται να ανακύψει από την παρούσα συμφωνία, τα μέρη θα επιδιώξουν φιλικό διακανονισμό. Εν τη απουσία αυτού, αρμόδια είναι τα δικαστήρια Αθηνών.",
    },
    {
      title: "8. Προστασία προσωπικών δεδομένων",
      body: "Η επεξεργασία των προσωπικών δεδομένων διενεργείται σύμφωνα με τον ΓΚΠΔ (GDPR) και την πολιτική απορρήτου του SmartMove.",
    },
  ];

  const preamble = `Στις ${fmtDate(d.generatedAt)} συντάχθηκε ηλεκτρονικά η παρούσα συμφωνία μεταφοράς, μέσω της ψηφιακής πλατφόρμας SmartMove, μεταξύ των κάτωθι συμβαλλομένων μερών.`;

  return { preamble, partyA, partyB, subject, terms };
}

// ---------------- DOCX ----------------

function docxKvTable(b: Block): (Paragraph | Table)[] {
  const spacer = new Paragraph({ spacing: { before: 240, after: 0 }, children: [] });

  // Eyebrow header row spanning both columns
  const headerRow = new TableRow({
    children: [
      new TableCell({
        columnSpan: 2,
        width: { size: 100, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: ShadingType.SOLID, color: BRAND.blueLight, fill: BRAND.blueLight },
        children: [
          new Paragraph({
            spacing: { before: 80, after: 80 },
            children: [
              new TextRun({
                text: b.heading.toUpperCase(),
                bold: true,
                size: 18,
                color: BRAND.blueDeep,
                font: "Calibri",
                characterSpacing: 24,
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const dataRows = b.rows.map(
    ([label, value]) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 32, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                spacing: { before: 80, after: 80 },
                children: [
                  new TextRun({
                    text: label.toUpperCase(),
                    bold: true,
                    size: 16,
                    color: BRAND.muted,
                    font: "Calibri",
                    characterSpacing: 12,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 68, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                spacing: { before: 80, after: 80 },
                children: [
                  new TextRun({
                    text: value,
                    size: 20,
                    color: BRAND.foreground,
                    font: "Calibri",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
  );

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
    borders: kvBorders(),
  });
  return [spacer, table];
}

function kvBorders() {
  const c = { style: BorderStyle.SINGLE, size: 4, color: BRAND.border };
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return {
    top: c,
    bottom: c,
    left: c,
    right: c,
    insideHorizontal: c,
    insideVertical: none,
  };
}

function docxItemsBlock(d: ContractData, photos: Map<string, FetchedPhoto>): (Paragraph | Table)[] {
  if (d.items.length === 0) return [];

  const heading = new Paragraph({
    spacing: { before: 300, after: 120 },
    children: [
      new TextRun({
        text: "ΛΙΣΤΑ ΑΝΤΙΚΕΙΜΕΝΩΝ",
        bold: true,
        size: 22,
        color: BRAND.blueDeep,
        font: "Calibri",
      }),
    ],
  });
  const summary = new Paragraph({
    spacing: { after: 120 },
    children: [
      new TextRun({
        text: `${d.items.reduce((s, i) => s + i.quantity, 0)} αντικείμενα · `,
        size: 18,
        color: BRAND.muted,
        font: "Calibri",
      }),
      new TextRun({
        text: `${d.request.volumeM3.toFixed(2)} m³ συνολικά`,
        size: 18,
        bold: true,
        color: BRAND.foreground,
        font: "Calibri",
      }),
    ],
  });

  // Header row
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      itemHeaderCell("Φωτο", 12),
      itemHeaderCell("Αντικείμενο", 38),
      itemHeaderCell("Τεμ.", 10),
      itemHeaderCell("Διαστάσεις (cm)", 25),
      itemHeaderCell("m³", 15),
    ],
  });

  const rows = d.items.map((it) => {
    const photo = it.photoUrl ? photos.get(it.photoUrl) : null;
    const photoCell = new TableCell({
      width: { size: 12, type: WidthType.PERCENTAGE },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        photo
          ? new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  data: photo.buffer,
                  transformation: { width: 48, height: 48 },
                  type: photo.mime === "image/png" ? "png" : "jpg",
                }),
              ],
            })
          : new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: "—",
                  size: 18,
                  color: BRAND.muted,
                  font: "Calibri",
                }),
              ],
            }),
      ],
    });
    return new TableRow({
      height: { value: 800, rule: HeightRule.ATLEAST },
      children: [
        photoCell,
        new TableCell({
          width: { size: 38, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: it.name,
                  size: 20,
                  bold: true,
                  color: BRAND.foreground,
                  font: "Calibri",
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 10, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: `×${it.quantity}`,
                  size: 20,
                  bold: true,
                  color: BRAND.foreground,
                  font: "Calibri",
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: `${it.length_cm}×${it.width_cm}×${it.height_cm}`,
                  size: 18,
                  color: BRAND.muted,
                  font: "Calibri",
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 15, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({
                  text: (it.volume_m3 * it.quantity).toFixed(2),
                  size: 18,
                  bold: true,
                  color: BRAND.foreground,
                  font: "Calibri",
                }),
              ],
            }),
          ],
        }),
      ],
    });
  });

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...rows],
    borders: kvBorders(),
  });

  return [heading, summary, table];
}

function itemHeaderCell(text: string, widthPct: number): TableCell {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    shading: { type: ShadingType.SOLID, color: BRAND.blueLight, fill: BRAND.blueLight },
    children: [
      new Paragraph({
        spacing: { before: 80, after: 80 },
        alignment:
          text === "m³" ? AlignmentType.RIGHT : text === "Τεμ." ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            bold: true,
            size: 16,
            color: BRAND.blueDeep,
            font: "Calibri",
          }),
        ],
      }),
    ],
  });
}

async function buildDocxBuffer(
  d: ContractData,
  photos: Map<string, FetchedPhoto>,
): Promise<Buffer> {
  const c = buildContent(d);

  const headerBar = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.SINGLE, size: 12, color: BRAND.blue },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "SmartMove",
                    bold: true,
                    size: 28,
                    color: BRAND.blue,
                    font: "Calibri",
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Ψηφιακή πλατφόρμα μεταφορών",
                    size: 16,
                    color: BRAND.muted,
                    font: "Calibri",
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: "ΣΥΜΦΩΝΗΤΙΚΟ",
                    bold: true,
                    size: 16,
                    color: BRAND.muted,
                    font: "Calibri",
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: d.ref,
                    bold: true,
                    size: 24,
                    color: BRAND.foreground,
                    font: "Calibri",
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: fmtDateTime(d.generatedAt),
                    size: 14,
                    color: BRAND.muted,
                    font: "Calibri",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const title = new Paragraph({
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { before: 360, after: 120 },
    children: [
      new TextRun({
        text: "ΣΥΜΦΩΝΗΤΙΚΟ ΜΕΤΑΦΟΡΑΣ",
        bold: true,
        size: 36,
        color: BRAND.foreground,
        font: "Calibri",
      }),
    ],
  });

  const preamble = new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 200 },
    children: [
      new TextRun({
        text: c.preamble,
        size: 20,
        color: BRAND.foreground,
        font: "Calibri",
      }),
    ],
  });

  const partyA = docxKvTable(c.partyA);
  const partyB = docxKvTable(c.partyB);
  const subject = docxKvTable(c.subject);
  const itemsBlock = docxItemsBlock(d, photos);

  const termsHeader = new Paragraph({
    spacing: { before: 360, after: 120 },
    children: [
      new TextRun({
        text: "ΟΡΟΙ ΣΥΜΦΩΝΙΑΣ",
        bold: true,
        size: 22,
        color: BRAND.blueDeep,
        font: "Calibri",
      }),
    ],
  });
  const termParas = c.terms.flatMap((t) => [
    new Paragraph({
      spacing: { before: 160, after: 60 },
      children: [
        new TextRun({
          text: t.title,
          bold: true,
          size: 19,
          color: BRAND.foreground,
          font: "Calibri",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: t.body,
          size: 18,
          color: BRAND.foreground,
          font: "Calibri",
        }),
      ],
    }),
  ]);

  const signature = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 480 },
    children: [
      new TextRun({
        text: "Η αποδοχή της προσφοράς μέσω της ψηφιακής πλατφόρμας SmartMove επέχει θέση ηλεκτρονικής υπογραφής αμφοτέρων των μερών.",
        italics: true,
        size: 16,
        color: BRAND.muted,
        font: "Calibri",
      }),
    ],
  });

  const doc = new Document({
    creator: "SmartMove",
    title: `Σύμφωνητικό μεταφοράς ${d.ref}`,
    styles: {
      default: {
        document: { run: { font: "Calibri" } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 900, bottom: 900, left: 1000, right: 1000 },
          },
        },
        children: [
          headerBar,
          title,
          preamble,
          ...partyA,
          ...partyB,
          ...subject,
          ...itemsBlock,
          termsHeader,
          ...termParas,
          signature,
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

// ---------------- PDF (pdfkit + Inter TTF) ----------------

const PDF = {
  pageMargin: 56,
  // Convert hex string to "#RRGGBB" for pdfkit
  hex: (h: string) => `#${h}`,
};

async function buildPdfBuffer(
  d: ContractData,
  photos: Map<string, FetchedPhoto>,
): Promise<Buffer> {
  const fonts = await loadInterFonts();
  const c = buildContent(d);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: {
          top: PDF.pageMargin,
          bottom: PDF.pageMargin,
          left: PDF.pageMargin,
          right: PDF.pageMargin,
        },
        info: {
          Title: `Συμφωνητικό μεταφοράς ${d.ref}`,
          Author: "SmartMove",
          Subject: "Σύμφωνηση μεταφοράς",
        },
      });

      // Register fonts (TTF buffers with full Greek glyph coverage)
      doc.registerFont("Regular", fonts.regular);
      doc.registerFont("SemiBold", fonts.semibold);
      doc.registerFont("Bold", fonts.bold);
      doc.font("Regular");

      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c as Buffer));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageW = doc.page.width - PDF.pageMargin * 2;

      // ----- Header strip -----
      drawHeader(doc, d, pageW);

      // ----- Title -----
      doc.moveDown(1.2);
      doc
        .font("Bold")
        .fontSize(22)
        .fillColor(PDF.hex(BRAND.foreground))
        .text("ΣΥΜΦΩΝΗΤΙΚΟ ΜΕΤΑΦΟΡΑΣ", { align: "center" });
      doc.moveDown(0.6);

      // Preamble
      doc
        .font("Regular")
        .fontSize(10)
        .fillColor(PDF.hex(BRAND.foreground))
        .text(c.preamble, { align: "justify", lineGap: 2 });
      doc.moveDown(1.4);

      // ----- KV blocks -----
      drawKvBlock(doc, c.partyA, pageW);
      drawKvBlock(doc, c.partyB, pageW);
      drawKvBlock(doc, c.subject, pageW);

      // ----- Items section -----
      if (d.items.length > 0) {
        drawItemsTable(doc, d, photos, pageW);
      }

      // ----- Terms -----
      doc.moveDown(1.2);
      doc
        .font("Bold")
        .fontSize(13)
        .fillColor(PDF.hex(BRAND.blueDeep))
        .text("ΟΡΟΙ ΣΥΜΦΩΝΙΑΣ");
      doc.moveDown(0.4);
      for (const t of c.terms) {
        doc
          .font("SemiBold")
          .fontSize(10.5)
          .fillColor(PDF.hex(BRAND.foreground))
          .text(t.title);
        doc.moveDown(0.15);
        doc
          .font("Regular")
          .fontSize(9.5)
          .fillColor(PDF.hex(BRAND.foreground))
          .text(t.body, { align: "justify", lineGap: 1.5 });
        doc.moveDown(0.5);
      }

      // ----- Footer -----
      doc.moveDown(1.5);
      doc
        .font("Regular")
        .fontSize(9)
        .fillColor(PDF.hex(BRAND.muted))
        .text(
          "Η αποδοχή της προσφοράς μέσω της ψηφιακής πλατφόρμας SmartMove επέχει θέση ηλεκτρονικής υπογραφής αμφοτέρων των μερών.",
          { align: "center" },
        );

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

type PDFDoc = InstanceType<typeof PDFDocument>;

function drawHeader(doc: PDFDoc, d: ContractData, pageW: number) {
  const startY = doc.y;
  const leftX = doc.page.margins.left;
  // Left: brand
  doc
    .font("Bold")
    .fontSize(22)
    .fillColor(PDF.hex(BRAND.blue))
    .text("SmartMove", leftX, startY, { width: pageW * 0.6 });
  doc
    .font("Regular")
    .fontSize(8.5)
    .fillColor(PDF.hex(BRAND.muted))
    .text("Ψηφιακή πλατφόρμα μεταφορών", leftX, doc.y + 2, { width: pageW * 0.6 });

  // Right: ref pill (offer-card style) + date
  const rightX = leftX + pageW * 0.55;
  doc
    .font("SemiBold")
    .fontSize(8)
    .fillColor(PDF.hex(BRAND.muted))
    .text("ΣΥΜΦΩΝΗΤΙΚΟ", rightX, startY, {
      width: pageW * 0.45,
      align: "right",
      characterSpacing: 1.2,
    });
  doc
    .font("Bold")
    .fontSize(15)
    .fillColor(PDF.hex(BRAND.foreground))
    .text(d.ref, rightX, doc.y + 1, { width: pageW * 0.45, align: "right" });
  doc
    .font("Regular")
    .fontSize(8)
    .fillColor(PDF.hex(BRAND.muted))
    .text(fmtDateTime(d.generatedAt), rightX, doc.y + 1, {
      width: pageW * 0.45,
      align: "right",
    });

  // Sync cursor below both columns
  doc.x = leftX;
  doc.y = startY + 56;

  // Thin accent bar (1px) — restrained, no thick stripe
  doc
    .save()
    .lineWidth(1)
    .strokeColor(PDF.hex(BRAND.blue))
    .moveTo(leftX, doc.y)
    .lineTo(leftX + pageW, doc.y)
    .stroke()
    .restore();
}

function drawKvBlock(doc: PDFDoc, b: Block, pageW: number) {
  doc.moveDown(0.7);
  const leftX = doc.page.margins.left;
  const labelW = pageW * 0.32;
  const valueX = leftX + labelW;
  const valueW = pageW - labelW;

  // ── Eyebrow header strip (offer-card aesthetic):
  // light blue tint background + small uppercase title in deep blue.
  const headerH = 22;
  const headerY = doc.y;
  doc
    .save()
    .rect(leftX, headerY, pageW, headerH)
    .fillColor(PDF.hex(BRAND.blueLight))
    .fill()
    .restore();
  doc
    .font("SemiBold")
    .fontSize(9)
    .fillColor(PDF.hex(BRAND.blueDeep))
    .text(b.heading.toUpperCase(), leftX + 10, headerY + 6, {
      width: pageW - 20,
      characterSpacing: 1.2,
    });
  // Top + bottom hairlines on header
  doc
    .save()
    .lineWidth(0.5)
    .strokeColor(PDF.hex(BRAND.border))
    .moveTo(leftX, headerY)
    .lineTo(leftX + pageW, headerY)
    .stroke()
    .moveTo(leftX, headerY + headerH)
    .lineTo(leftX + pageW, headerY + headerH)
    .stroke()
    .restore();
  doc.y = headerY + headerH;

  // ── Rows: no heavy borders, only subtle bottom hairline per row.
  for (const [label, value] of b.rows) {
    const startY = doc.y;
    const valueHeight = doc
      .font("Regular")
      .fontSize(10)
      .heightOfString(value, { width: valueW - 14 });
    const rowH = Math.max(22, valueHeight + 10);

    doc
      .font("SemiBold")
      .fontSize(8.5)
      .fillColor(PDF.hex(BRAND.muted))
      .text(label.toUpperCase(), leftX + 10, startY + 7, {
        width: labelW - 14,
        characterSpacing: 0.6,
      });

    doc
      .font("Regular")
      .fontSize(10)
      .fillColor(PDF.hex(BRAND.foreground))
      .text(value, valueX, startY + 6, { width: valueW - 6 });

    // Bottom divider only
    doc
      .save()
      .lineWidth(0.4)
      .strokeColor(PDF.hex(BRAND.border))
      .moveTo(leftX, startY + rowH)
      .lineTo(leftX + pageW, startY + rowH)
      .stroke()
      .restore();

    doc.y = startY + rowH;
  }
}

function drawItemsTable(
  doc: PDFDoc,
  d: ContractData,
  photos: Map<string, FetchedPhoto>,
  pageW: number,
) {
  doc.moveDown(0.8);
  doc
    .font("Bold")
    .fontSize(11.5)
    .fillColor(PDF.hex(BRAND.blueDeep))
    .text("ΛΙΣΤΑ ΑΝΤΙΚΕΙΜΕΝΩΝ");
  const totalQty = d.items.reduce((s, i) => s + i.quantity, 0);
  doc
    .font("Regular")
    .fontSize(9)
    .fillColor(PDF.hex(BRAND.muted))
    .text(`${totalQty} αντικείμενα · ${d.request.volumeM3.toFixed(2)} m³ συνολικά`);
  doc.moveDown(0.3);

  const leftX = doc.page.margins.left;
  const cols = [
    { key: "photo", label: "", w: pageW * 0.1, align: "center" as const },
    { key: "name", label: "Αντικείμενο", w: pageW * 0.4, align: "left" as const },
    { key: "qty", label: "Τεμ.", w: pageW * 0.1, align: "center" as const },
    {
      key: "dim",
      label: "Διαστάσεις (cm)",
      w: pageW * 0.25,
      align: "left" as const,
    },
    { key: "vol", label: "m³", w: pageW * 0.15, align: "right" as const },
  ];

  // Header
  let cx = leftX;
  const headerY = doc.y;
  const headerH = 20;
  doc
    .save()
    .rect(leftX, headerY, pageW, headerH)
    .fillColor(PDF.hex(BRAND.blueLight))
    .fill()
    .restore();
  for (const col of cols) {
    if (col.label) {
      doc
        .font("Bold")
        .fontSize(8.5)
        .fillColor(PDF.hex(BRAND.blueDeep))
        .text(col.label, cx + 6, headerY + 6, {
          width: col.w - 12,
          align: col.align,
        });
    }
    cx += col.w;
  }
  // Header bottom border
  doc
    .save()
    .lineWidth(0.5)
    .strokeColor(PDF.hex(BRAND.border))
    .rect(leftX, headerY, pageW, headerH)
    .stroke()
    .restore();
  doc.y = headerY + headerH;

  // Rows
  for (const it of d.items) {
    // Page break if needed
    if (doc.y > doc.page.height - 100) {
      doc.addPage();
    }
    const startY = doc.y;
    const rowH = 38;

    // Photo
    const photo = it.photoUrl ? photos.get(it.photoUrl) : null;
    if (photo) {
      try {
        doc.image(photo.buffer, leftX + 6, startY + 4, {
          width: 30,
          height: 30,
        });
      } catch {
        // image embed failed; skip
      }
    } else {
      doc
        .font("Regular")
        .fontSize(10)
        .fillColor(PDF.hex(BRAND.muted))
        .text("—", leftX + 6, startY + 12, { width: cols[0].w - 12, align: "center" });
    }

    let x = leftX + cols[0].w;
    // Name
    doc
      .font("SemiBold")
      .fontSize(10)
      .fillColor(PDF.hex(BRAND.foreground))
      .text(it.name, x + 6, startY + 12, { width: cols[1].w - 12 });
    x += cols[1].w;
    // Quantity
    doc
      .font("Bold")
      .fontSize(10.5)
      .fillColor(PDF.hex(BRAND.foreground))
      .text(`×${it.quantity}`, x + 6, startY + 12, {
        width: cols[2].w - 12,
        align: "center",
      });
    x += cols[2].w;
    // Dimensions
    doc
      .font("Regular")
      .fontSize(9)
      .fillColor(PDF.hex(BRAND.muted))
      .text(`${it.length_cm}×${it.width_cm}×${it.height_cm}`, x + 6, startY + 13, {
        width: cols[3].w - 12,
      });
    x += cols[3].w;
    // Volume
    doc
      .font("Bold")
      .fontSize(10)
      .fillColor(PDF.hex(BRAND.foreground))
      .text((it.volume_m3 * it.quantity).toFixed(2), x + 6, startY + 12, {
        width: cols[4].w - 12,
        align: "right",
      });

    // Row border
    doc
      .save()
      .lineWidth(0.5)
      .strokeColor(PDF.hex(BRAND.border))
      .rect(leftX, startY, pageW, rowH)
      .stroke()
      .restore();

    doc.y = startY + rowH;
  }
}

// ---------------- Public API ----------------

async function ensureStore() {
  await fs.mkdir(STORE_DIR, { recursive: true });
}

export async function buildAndStoreContract(
  d: ContractData,
): Promise<{ docxUrl: string; pdfUrl: string }> {
  await ensureStore();
  const photos = await fetchPhotos(d.items);
  const [docxBuf, pdfBuf] = await Promise.all([
    buildDocxBuffer(d, photos),
    buildPdfBuffer(d, photos),
  ]);
  const slug = `${d.ref}-${Date.now()}`;
  const docxName = `contract-${slug}.docx`;
  const pdfName = `contract-${slug}.pdf`;
  await fs.writeFile(path.join(STORE_DIR, docxName), docxBuf);
  await fs.writeFile(path.join(STORE_DIR, pdfName), pdfBuf);
  return {
    docxUrl: `/contracts/${docxName}`,
    pdfUrl: `/contracts/${pdfName}`,
  };
}

export async function buildContractBuffers(d: ContractData): Promise<{
  docx: Buffer;
  pdf: Buffer;
}> {
  const photos = await fetchPhotos(d.items);
  const [docx, pdf] = await Promise.all([
    buildDocxBuffer(d, photos),
    buildPdfBuffer(d, photos),
  ]);
  return { docx, pdf };
}
