// next.config.ts
import type { NextConfig } from "next";

// GitHub Pages serves a project site from /<repo>, so CI passes the base path in.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // Static export: GitHub Pages has no server, so every route is prerendered to HTML.
  output: "export",
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
  allowedDevOrigins: ["10.0.0.169:3000", "10.0.0.169"],
  // pdfjs-dist optionally requires the native "canvas" package, which the browser build never uses.
  turbopack: {
    resolveAlias: {
      canvas: "./empty_module.js",
    },
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
