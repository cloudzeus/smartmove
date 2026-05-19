import type { Metadata, Viewport } from "next";
import { Inter, Manrope, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext", "greek"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SmartMove — Η έξυπνη κίνηση για κάθε μεταφορά",
    template: "%s · SmartMove",
  },
  description:
    "Δημοσίευσε τη μεταφορά ή τη μετακόμισή σου και λάβε προσφορές από επαγγελματίες μεταφορείς. Σύγκρινε τιμές, αξιολογήσεις και διαθεσιμότητα.",
  applicationName: "SmartMove",
  keywords: [
    "μεταφορές",
    "μετακόμιση",
    "marketplace μεταφορών",
    "προσφορές μεταφορέων",
    "SmartMove",
  ],
  authors: [{ name: "SmartMove" }],
  openGraph: {
    title: "SmartMove — Η έξυπνη κίνηση για κάθε μεταφορά",
    description:
      "Marketplace μεταφορών και μετακομίσεων. Δημοσίευσε αίτημα, λάβε προσφορές, επίλεξε τον μεταφορέα που σου ταιριάζει.",
    locale: "el_GR",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563EB",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return (
    <html
      lang={locale}
      className={`${inter.variable} ${manrope.variable} ${geistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
