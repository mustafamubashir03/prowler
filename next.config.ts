import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // The Claude Agent SDK ships an ESM entry that resolves its own CLI binary at
  // import time, so Turbopack cannot statically bundle it. Opting it out keeps
  // it on native require, which is how it is meant to be loaded.
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk"],
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
