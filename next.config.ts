import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep @huggingface/transformers out of the server bundle.
  // It is dynamically imported client-side only; onnxruntime-web fetches wasm from CDN.
  serverExternalPackages: ["@huggingface/transformers"],

  // Turbopack (default in Next.js 16) — stub out the native onnxruntime-node
  // addon so it doesn't appear in the browser bundle.
  turbopack: {
    resolveAlias: {
      "onnxruntime-node": "./lib/onnxruntime-node-stub.ts",
    },
  },
};

export default nextConfig;
