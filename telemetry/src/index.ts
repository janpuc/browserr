/// <reference types="@cloudflare/workers-types" />

// Browserr install counter + anonymous telemetry. Instances POST a daily
// heartbeat (UUID + non-PII facts); one KV key per instance (35-day TTL) holds
// the facts in metadata so /stats can tally from list() alone.
// Public: /ping, /badge. Basic-auth gated (set STATS_PASS): /stats, /dashboard.
export interface Env {
  INSTALLS: KVNamespace;
  STATS_USER?: string;
  STATS_PASS?: string;
}

const TTL_SECONDS = 60 * 60 * 24 * 35;
const MAX_BODY = 4096;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const str = (v: unknown, max: number): string => (typeof v === "string" && v ? v.slice(0, max) : "");
const enumOf = (v: unknown, allowed: readonly string[]): string =>
  typeof v === "string" && allowed.includes(v) ? v : "unknown";

interface Meta {
  v: string; rt: string; pf: string; ar: string; nd: string;
  am: string; rm: string; sc: boolean; rg: string; t: number;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (request.method === "POST" && pathname === "/ping") return ping(request, env);
    if (request.method === "GET" && pathname === "/badge") return badge(env);
    if (request.method === "GET" && pathname === "/stats") return gated(request, env, () => stats(env));
    if (request.method === "GET" && pathname === "/dashboard") return gated(request, env, () => dashboard());
    return new Response("browserr telemetry\n", { status: 200 });
  },
};

function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}

/** Basic-auth gate; locked entirely until STATS_PASS is configured. */
async function gated(request: Request, env: Env, fn: () => Response | Promise<Response>): Promise<Response> {
  const header = request.headers.get("authorization") ?? "";
  let ok = false;
  if (env.STATS_PASS && header.startsWith("Basic ")) {
    try {
      const d = atob(header.slice(6).trim());
      const i = d.indexOf(":");
      ok =
        safeEqual(i < 0 ? d : d.slice(0, i), env.STATS_USER || "admin") &&
        safeEqual(i < 0 ? "" : d.slice(i + 1), env.STATS_PASS);
    } catch {
      /* fall through */
    }
  }
  if (!ok) {
    return new Response("auth required", {
      status: 401,
      headers: { "www-authenticate": 'Basic realm="browserr telemetry"' },
    });
  }
  return fn();
}

async function ping(request: Request, env: Env): Promise<Response> {
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY) {
    return new Response("payload too large", { status: 413 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response("bad json", { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id : "";
  if (!UUID_RE.test(id)) return new Response("bad id", { status: 400 });

  const meta: Meta = {
    v: str(body.version, 24) || "unknown",
    rt: enumOf(body.runtime, ["node", "docker", "kubernetes"]),
    pf: str(body.platform, 12) || "unknown",
    ar: str(body.arch, 12) || "unknown",
    nd: str(body.node, 16) || "unknown",
    am: enumOf(body.authMode, ["none", "basic", "seerr"]),
    rm: enumOf(body.requestMode, ["redirect", "proxy"]),
    sc: body.seerrConfigured === true,
    rg: str(body.region, 4).toUpperCase() || "unknown",
    t: Date.now(),
  };
  await env.INSTALLS.put(`i:${id}`, "", { expirationTtl: TTL_SECONDS, metadata: meta });
  return new Response(null, { status: 204 });
}

interface Stats {
  total: number; seerrConfigured: number;
  byVersion: Record<string, number>; byRuntime: Record<string, number>;
  byPlatform: Record<string, number>; byArch: Record<string, number>;
  byNode: Record<string, number>; byAuthMode: Record<string, number>;
  byRequestMode: Record<string, number>; byRegion: Record<string, number>;
}
const bump = (rec: Record<string, number>, key: string) => {
  rec[key] = (rec[key] ?? 0) + 1;
};

async function tally(env: Env): Promise<Stats> {
  const s: Stats = {
    total: 0, seerrConfigured: 0, byVersion: {}, byRuntime: {}, byPlatform: {},
    byArch: {}, byNode: {}, byAuthMode: {}, byRequestMode: {}, byRegion: {},
  };
  let cursor: string | undefined;
  for (;;) {
    const page = await env.INSTALLS.list<Partial<Meta>>({ prefix: "i:", cursor });
    for (const key of page.keys) {
      const m = key.metadata ?? {};
      s.total++;
      bump(s.byVersion, m.v ?? "unknown");
      bump(s.byRuntime, m.rt ?? "unknown");
      bump(s.byPlatform, m.pf ?? "unknown");
      bump(s.byArch, m.ar ?? "unknown");
      bump(s.byNode, m.nd ?? "unknown");
      bump(s.byAuthMode, m.am ?? "unknown");
      bump(s.byRequestMode, m.rm ?? "unknown");
      bump(s.byRegion, m.rg ?? "unknown");
      if (m.sc) s.seerrConfigured++;
    }
    if (page.list_complete) break;
    cursor = page.cursor;
  }
  return s;
}

async function badge(env: Env): Promise<Response> {
  const { total } = await tally(env);
  return Response.json(
    { schemaVersion: 1, label: "installs", message: String(total), color: "blue", cacheSeconds: 3600 },
    { headers: { "cache-control": "public, max-age=3600", "access-control-allow-origin": "*" } },
  );
}

async function stats(env: Env): Promise<Response> {
  return Response.json(await tally(env), { headers: { "cache-control": "private, max-age=60" } });
}

function dashboard(): Response {
  return new Response(DASHBOARD_HTML, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, max-age=60" },
  });
}

const DASHBOARD_HTML = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Browserr telemetry</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
  body{font:14px system-ui,sans-serif;margin:0;background:#0f0f0f;color:#eee}
  header{padding:20px 24px;border-bottom:1px solid #262626}
  h1{margin:0;font-size:18px} .total{font-size:40px;font-weight:800;color:#e23}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;padding:24px}
  .card{background:#171717;border:1px solid #262626;border-radius:10px;padding:16px}
  .card h2{margin:0 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#9a9a9a}
  a{color:#9ab}
</style></head><body>
<header><h1>Browserr - active installs (last ~35 days)</h1>
<div class="total" id="total">…</div>
<div id="extra" style="color:#9a9a9a"></div></header>
<div class="grid" id="grid"></div>
<script>
const COLORS=["#e23","#3b82f6","#22c55e","#eab308","#a855f7","#06b6d4","#f97316","#ec4899","#94a3b8"];
function chart(title,obj,type){
  const entries=Object.entries(obj||{}).sort((a,b)=>b[1]-a[1]).slice(0,12);
  const card=document.createElement("div");card.className="card";
  card.innerHTML='<h2>'+title+'</h2><canvas></canvas>';
  document.getElementById("grid").appendChild(card);
  new Chart(card.querySelector("canvas"),{type:type||"bar",
    data:{labels:entries.map(e=>e[0]),datasets:[{data:entries.map(e=>e[1]),backgroundColor:COLORS,borderWidth:0}]},
    options:{plugins:{legend:{display:type==="doughnut",labels:{color:"#bbb"}}},
      scales:type==="doughnut"?{}:{x:{ticks:{color:"#bbb"},grid:{display:false}},y:{ticks:{color:"#bbb"},grid:{color:"#222"}}}}});
}
fetch("/stats").then(r=>r.json()).then(s=>{
  document.getElementById("total").textContent=s.total;
  document.getElementById("extra").textContent=s.seerrConfigured+" of "+s.total+" have Seerr configured";
  chart("Version",s.byVersion);
  chart("Runtime",s.byRuntime,"doughnut");
  chart("Region",s.byRegion);
  chart("Platform / arch",s.byPlatform,"doughnut");
  chart("Node version",s.byNode);
  chart("Auth mode",s.byAuthMode,"doughnut");
  chart("Request mode",s.byRequestMode,"doughnut");
}).catch(e=>{document.getElementById("total").textContent="error: "+e});
</script></body></html>`;
