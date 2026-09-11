import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "21mb",
    },
    useTypeScriptCli: false,
  },
};

export default nextConfig;
