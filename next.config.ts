import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // pdfkit ships .afm font-metric data files and wawoff2 is a wasm-compiled
  // decoder — both need to be loaded from node_modules at runtime, not bundled.
  serverExternalPackages: ["pdfkit", "wawoff2"],
};

export default withNextIntl(nextConfig);
