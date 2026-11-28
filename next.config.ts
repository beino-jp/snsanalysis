import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["pg"],
  devIndicators: false,
  poweredByHeader: false,
  async headers(){return [{source:"/auth/finish",headers:[{key:"Cache-Control",value:"no-store"},{key:"Referrer-Policy",value:"no-referrer"}]}];},
};
export default config;
