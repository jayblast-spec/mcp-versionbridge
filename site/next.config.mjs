import path from "node:path";
import { fileURLToPath } from "node:url";
import { assetPrefix, basePath } from "./site.config.mjs";

const siteDir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath,
  assetPrefix,
  images: { unoptimized: true },
  trailingSlash: true,
  // This repo has its own lockfile at the root. Keep the site build rooted here.
  outputFileTracingRoot: siteDir,
  turbopack: { root: siteDir },
};

export default nextConfig;
