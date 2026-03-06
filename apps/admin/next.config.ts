import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    const strapiUrl = process.env.STRAPI_INTERNAL_URL ?? "http://localhost:1337";
    return [
      {
        source: "/api/:path*",
        destination: `${strapiUrl}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${strapiUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
