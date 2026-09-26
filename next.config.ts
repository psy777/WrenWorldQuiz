import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Next doesn't pick up a parent-dir lockfile.
  turbopack: { root: __dirname },
  // The World Map Quiz is a self-contained static app in public/worldquiz/.
  // Serve it at the clean /worldquiz path (and redirect the old /wren path).
  async rewrites() {
    return [{ source: "/worldquiz", destination: "/worldquiz/index.html" }];
  },
  async redirects() {
    return [{ source: "/wren", destination: "/worldquiz", permanent: true }];
  },
};

export default nextConfig;
