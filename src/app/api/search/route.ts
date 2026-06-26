import { handle, ok } from "@/server/http";
import { getTmdb } from "@/server/tmdb/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(async () => {
    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) return ok({ results: [] });
    const tmdb = await getTmdb();
    const results = await tmdb.search(q);
    return ok({ results });
  });
}
