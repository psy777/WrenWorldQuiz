import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Next doesn't pick up a parent-dir lockfile.
  turbopack: { root: __dirname },
  // The World Map Quiz is a self-contained static app in public/wren/.
  // Serve it at the clean /wren path.
  async rewrites() {
    return [{ source: "/wren", destination: "/wren/index.html" }];
  },
};

export default nextConfig;
