// Builds the static, keyless public demo (GitHub Pages).
//
// Next requires `export const dynamic` to be a string literal and rejects API
// route handlers under `output: export`. Neither is needed by the demo (it runs
// on bundled fixtures), so we briefly: (1) flip the page `dynamic` literals to
// "force-static", (2) move `src/app/api` aside, build, then (3) restore both.
//
//   NEXT_PUBLIC_BASE_PATH=/browserr node scripts/build-demo.mjs
import { execSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";

const PAGES = ["src/app/layout.tsx", "src/app/page.tsx", "src/app/settings/page.tsx"];
const API_DIR = "src/app/api";
const API_BAK = "src/app/_api_demo_bak";

const originals = new Map(PAGES.map((f) => [f, readFileSync(f, "utf8")]));

function patchPages() {
  for (const [file, src] of originals) {
    const patched = src.replace(/dynamic = "force-dynamic"/, 'dynamic = "force-static"');
    writeFileSync(file, patched);
  }
}

function restore() {
  for (const [file, src] of originals) writeFileSync(file, src);
  if (existsSync(API_BAK)) renameSync(API_BAK, API_DIR);
}

process.on("exit", restore);
process.on("SIGINT", () => process.exit(1));

try {
  patchPages();
  if (existsSync(API_DIR)) renameSync(API_DIR, API_BAK);

  execSync("node ./node_modules/next/dist/bin/next build", {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_DEMO: "1",
      NEXT_TELEMETRY_DISABLED: "1",
      NEXT_PUBLIC_VERSION: process.env.NEXT_PUBLIC_VERSION ?? "demo",
    },
  });

  // GitHub Pages serves with Jekyll by default, which hides the _next/ folder.
  writeFileSync("out/.nojekyll", "");
  console.log("\n✓ Static demo exported to ./out");
} catch (err) {
  console.error("\n✗ Demo build failed:", err.message);
  process.exitCode = 1;
}
