import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["qhack.mehdy.eu"],
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "https://api-qhack.mehdy.eu/api/:path*",
      },
    ];
  },
};

export default nextConfig;
