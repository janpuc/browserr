/// <reference types="@cloudflare/workers-types" />

/**
 * Browserr install counter. Each instance POSTs a daily anonymous heartbeat
 * `{ id, version }`; we store one KV key per instance with a 35-day TTL, so the
 * count reflects roughly the last month of *active* installs. `/badge` serves a
 * shields.io endpoint for the README.
 */
export interface Env {
  INSTALLS: KVNamespace;
}

const TTL_SECONDS = 60 * 60 * 24 * 35;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CACHE = { "cache-control": "public, max-age=3600" };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (request.method === "POST" && pathname === "/ping") return ping(request, env);
    if (request.method === "GET" && pathname === "/badge") return badge(env);
    if (request.method === "GET" && pathname === "/stats") return stats(env);
    return new Response("browserr telemetry\n", { status: 200 });
  },
};

async function ping(request: Request, env: Env): Promise<Response> {
  let body: { id?: unknown; version?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id : "";
  if (!UUID_RE.test(id)) return new Response("bad id", { status: 400 });
  const version = typeof body.version === "string" ? body.version.slice(0, 32) : "unknown";

  // Value is empty; the version + timestamp ride in metadata so we can tally
  // per-version straight from list() without a get() per key.
  await env.INSTALLS.put(`i:${id}`, "", {
    expirationTtl: TTL_SECONDS,
    metadata: { v: version, t: Date.now() },
  });
  return new Response(null, { status: 204 });
}

async function tally(env: Env): Promise<{ total: number; byVersion: Record<string, number> }> {
  let cursor: string | undefined;
  let total = 0;
  const byVersion: Record<string, number> = {};
  for (;;) {
    const page = await env.INSTALLS.list<{ v?: string }>({ prefix: "i:", cursor });
    for (const key of page.keys) {
      total++;
      const v = key.metadata?.v ?? "unknown";
      byVersion[v] = (byVersion[v] ?? 0) + 1;
    }
    if (page.list_complete) break;
    cursor = page.cursor;
  }
  return { total, byVersion };
}

async function badge(env: Env): Promise<Response> {
  const { total } = await tally(env);
  return Response.json(
    { schemaVersion: 1, label: "installs", message: String(total), color: "blue", cacheSeconds: 3600 },
    { headers: CACHE },
  );
}

async function stats(env: Env): Promise<Response> {
  return Response.json(await tally(env), { headers: CACHE });
}
