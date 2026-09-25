import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Next doesn't pick up a parent-dir lockfile.
  turbopack: { root: __dirname },
};

export default nextConfig;
