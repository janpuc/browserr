import { getConfig } from "@/server/config";
import { handle, HttpError, ok } from "@/server/http";
import { getSeerr } from "@/server/seerr/client";
import { getTmdb } from "@/server/tmdb/client";
import type { MediaType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ type: string; id: string }> },
) {
  return handle(async () => {
    const { type, id } = await ctx.params;
    if (type !== "movie" && type !== "tv") throw new HttpError(400, "Invalid media type");
    const tmdbId = Number.parseInt(id, 10);
    if (!Number.isFinite(tmdbId)) throw new HttpError(400, "Invalid id");
    const mediaType = type as MediaType;

    const cfg = await getConfig();
    const tmdb = await getTmdb();
    const seerr = await getSeerr();

    const [detail, availability] = await Promise.all([
      tmdb.getDetail(mediaType, tmdbId, cfg.region.region),
      seerr.getAvailability(mediaType, tmdbId),
    ]);

    // Build the redirect deep link from the EXTERNAL url only (never internal).
    const ext = cfg.seerr.externalUrl.replace(/\/+$/, "");
    const requestUrl = ext ? `${ext}/${mediaType}/${tmdbId}` : null;

    return ok({
      detail,
      availability,
      request: { mode: cfg.seerr.requestMode, redirectUrl: requestUrl },
    });
  });
}
