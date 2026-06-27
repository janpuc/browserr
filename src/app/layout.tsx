import "./globals.css";
import type { CSSProperties } from "react";
import { Github } from "lucide-react";
import type { Metadata, Viewport } from "next";
import { Navbar } from "@/components/Navbar";
import type { PublicConfig } from "@/lib/config";
import { DEMO, DEMO_PUBLIC_CONFIG } from "@/lib/demo";
import { Providers } from "./providers";

// Server build resolves config/DB per request. The demo build swaps this to
// "force-static" via scripts/build-demo.mjs (Next requires a literal here).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Browserr - browse everything you can stream",
  description:
    "A self-hosted, Netflix-style discovery front-end for your media stack, with deep Seerr integration.",
};

export const viewport: Viewport = {
  themeColor: "#0f0f0f",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let config: PublicConfig;
  if (DEMO) {
    // No DB, no cron, no secrets - the demo runs entirely on bundled fixtures.
    config = DEMO_PUBLIC_CONFIG;
  } else {
    // Server-only modules are imported lazily so they never enter the static
    // demo build graph. startCron is idempotent and only runs in the Node RSC.
    const [{ getPublicConfig }, { startCron }] = await Promise.all([
      import("@/server/config"),
      import("@/server/cron"),
    ]);
    startCron();
    config = await getPublicConfig();
  }

  const themeClass = config.appearance.theme === "light" ? "light" : "";
  const accentStyle = { "--accent": config.appearance.accent } as CSSProperties;

  return (
    <html lang="en" className={themeClass} suppressHydrationWarning>
      <body style={accentStyle}>
        <Providers initialConfig={config}>
          <Navbar />
          <main className="min-h-screen">{children}</main>
          {DEMO && <DemoBadge />}
        </Providers>
      </body>
    </html>
  );
}

/** Floating ribbon shown only in the public demo build. */
function DemoBadge() {
  return (
    <a
      href="https://github.com/janpuc/browserr"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-4 left-1/2 z-[90] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-border bg-background/90 px-4 py-2 text-xs font-semibold shadow-xl backdrop-blur transition hover:border-accent"
    >
      <span className="inline-flex h-2 w-2 rounded-full bg-accent" />
      <span className="hidden sm:inline">Demo - requests &amp; settings are disabled</span>
      <span className="sm:hidden">Demo</span>
      <span className="mx-0.5 h-3 w-px bg-border" />
      <Github className="h-3.5 w-3.5" /> janpuc/browserr
    </a>
  );
}
