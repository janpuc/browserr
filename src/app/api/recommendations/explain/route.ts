import { handle, HttpError, ok } from "@/server/http";
import { explainRecommendation } from "@/server/recommend/engine";
import { getCurrentUserId } from "@/server/user";
import type { MediaType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** "Why am I seeing this?" - the top features linking a title to your taste. */
export async function GET(req: Request) {
  return handle(async () => {
    const url = new URL(req.url);
    const type = url.searchParams.get("type");
    const id = Number.parseInt(url.searchParams.get("id") ?? "", 10);
    if ((type !== "movie" && type !== "tv") || !Number.isFinite(id)) {
      throw new HttpError(400, "type and id are required");
    }
    const userId = await getCurrentUserId();
    return ok(await explainRecommendation(userId, id, type as MediaType));
  });
}
