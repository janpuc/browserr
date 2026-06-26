import { getConfig, VERSION } from "@/server/config";
import { handle, ok } from "@/server/http";
import { getSeerr } from "@/server/seerr/client";
import { getTmdb } from "@/server/tmdb/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const [cfg, tmdb, seerr] = await Promise.all([getConfig(), getTmdb(), getSeerr()]);
    return ok({
      status: "ok",
      version: VERSION,
      time: new Date().toISOString(),
      region: cfg.region.region,
      tmdb: { configured: tmdb.isConfigured() },
      seerr: { configured: seerr.isConfigured(), requestMode: cfg.seerr.requestMode },
    });
  });
}
