/** @type {import('next').NextConfig} */

// The public demo is a static, keyless export (GitHub Pages). The normal build
// is the standalone server image. NEXT_PUBLIC_DEMO=1 selects the demo build.
const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

const images = {
  // TMDB already serves correctly-sized images via the path (w342/w780/…),
  // so we skip server-side re-optimization (and the sharp dependency). We
  // still drive responsive sizes through the requested TMDB size.
  unoptimized: true,
  // TMDB image CDN + YouTube thumbnails. Provider logos also come from TMDB.
  remotePatterns: [
    { protocol: "https", hostname: "image.tmdb.org" },
    { protocol: "https", hostname: "i.ytimg.com" },
    { protocol: "https", hostname: "img.youtube.com" },
  ],
};

/** Static export for the public demo (no server, no DB, no API routes). */
const demoConfig = {
  reactStrictMode: true,
  output: "export",
  // Project Pages live under /<repo>; set NEXT_PUBLIC_BASE_PATH=/browserr in CI.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  trailingSlash: true,
  images,
};

/** Standalone server bundle for the slim Docker image. */
const serverConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Ensure libsql's native binaries are traced into the standalone output
  // (native modules are otherwise sometimes missed by file-tracing).
  outputFileTracingIncludes: {
    "/**/*": ["./node_modules/@libsql/**/*", "./node_modules/libsql/**/*"],
  },
  // libsql ships optional native bits; keep it external to the server bundle.
  serverExternalPackages: ["@libsql/client", "libsql"],
  images,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          // X-Frame-Options / HSTS deliberately omitted (homelab iframe embedding +
          // plain HTTP behind a TLS proxy); see SECURITY.md to opt in.
        ],
      },
    ];
  },
};

export default DEMO ? demoConfig : serverConfig;
