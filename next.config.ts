import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,

  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  serverExternalPackages: ["@prisma/adapter-pg", "pg"],
};

export default nextConfig;