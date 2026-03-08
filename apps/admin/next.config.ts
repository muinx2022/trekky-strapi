import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_WEB_URL: process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000",
  },
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
