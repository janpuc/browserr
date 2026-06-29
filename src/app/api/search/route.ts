import { clientKey, handle, ok, rateLimit } from "@/server/http";
import { getTmdb } from "@/server/tmdb/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(async () => {
    rateLimit(clientKey(req, "search"), 40, 60_000);
    const q = (new URL(req.url).searchParams.get("q")?.trim() ?? "").slice(0, 120);
    if (q.length < 2) return ok({ results: [] });
    const tmdb = await getTmdb();
    const results = await tmdb.search(q);
    return ok({ results });
  });
}
