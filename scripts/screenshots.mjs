// Captures README screenshots from the static demo in ./out.
//
//   npm run build:demo
//   npm i -D playwright && npx playwright install chromium
//   npm run screenshots
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const ROOT = "out";
const SHOTS = "docs/screenshots";

if (!existsSync(ROOT)) {
  console.error("No ./out — run `npm run build:demo` first.");
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Playwright missing. Run: npm i -D playwright && npx playwright install chromium");
  process.exit(1);
}

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
  ".woff2": "font/woff2",
};

const server = createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(req.url.split("?")[0]));
  if (path.endsWith("/")) path += "index.html";
  let file = join(ROOT, path);
  if (!existsSync(file)) file = join(ROOT, path, "index.html");
  try {
    const buf = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(buf);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});

await new Promise((r) => server.listen(4321, r));
const BASE = "http://127.0.0.1:4321";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(3000); // hero + rail images settle
await page.screenshot({ path: `${SHOTS}/home.png` });

await page
  .locator('[role="button"][aria-label]')
  .first()
  .click()
  .catch(() => {});
await page.waitForTimeout(2500);
await page.screenshot({ path: `${SHOTS}/detail.png` });

await page.goto(`${BASE}/settings/`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${SHOTS}/settings.png` });

await browser.close();
server.close();
console.log(`Saved ${SHOTS}/{home,detail,settings}.png`);
