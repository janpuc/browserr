import { z } from "zod";
import { getConfig } from "@/server/config";
import { assertSameOrigin, clientKey, handle, HttpError, ok, rateLimit } from "@/server/http";
import { getSeerr } from "@/server/seerr/client";
import { recordSignal } from "@/server/recommend/signals";
import { getCurrentUserId } from "@/server/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  tmdbId: z.number().int().positive(),
  mediaType: z.enum(["movie", "tv"]),
  seasons: z.union([z.array(z.number().int().nonnegative()), z.literal("all")]).optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    rateLimit(clientKey(req, "request"), 30, 60_000);
    const body = bodySchema.parse(await req.json());
    const cfg = await getConfig();
    const userId = await getCurrentUserId();

    // Requesting is a strong positive taste signal regardless of mode.
    await recordSignal(userId, {
      tmdbId: body.tmdbId,
      mediaType: body.mediaType,
      type: "request",
    }).catch(() => {});

    if (cfg.seerr.requestMode === "proxy") {
      // Proxy submits server-side via the INTERNAL url; client never sees it.
      const seerr = await getSeerr();
      if (!seerr.isConfigured()) throw new HttpError(503, "Seerr is not configured");
      const created = await seerr.createRequest({
        mediaType: body.mediaType,
        mediaId: body.tmdbId,
        seasons: body.mediaType === "tv" ? (body.seasons ?? "all") : undefined,
      });
      return ok({ mode: "proxy", ok: true, request: created });
    }

    // Redirect mode: hand back the EXTERNAL deep link for the browser to open.
    const ext = cfg.seerr.externalUrl.replace(/\/+$/, "");
    if (!ext) throw new HttpError(503, "Seerr external URL is not configured");
    return ok({ mode: "redirect", ok: true, redirectUrl: `${ext}/${body.mediaType}/${body.tmdbId}` });
  });
}
