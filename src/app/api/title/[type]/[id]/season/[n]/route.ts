import { handle, HttpError, ok } from "@/server/http";
import { getTmdb } from "@/server/tmdb/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ type: string; id: string; n: string }> },
) {
  return handle(async () => {
    const { type, id, n } = await ctx.params;
    if (type !== "tv") throw new HttpError(400, "Seasons are only available for TV titles");
    const tmdbId = Number.parseInt(id, 10);
    const seasonNumber = Number.parseInt(n, 10);
    if (!Number.isFinite(tmdbId) || !Number.isFinite(seasonNumber)) {
      throw new HttpError(400, "Invalid id or season number");
    }
    const tmdb = await getTmdb();
    const episodes = await tmdb.getSeasonEpisodes(tmdbId, seasonNumber);
    return ok({ episodes });
  });
}
