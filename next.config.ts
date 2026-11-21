import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["pg"],
  devIndicators: false,
  poweredByHeader: false,
};
export default config;
