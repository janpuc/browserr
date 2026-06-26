import { z } from "zod";
import { isSignalType, SIGNAL_TYPES } from "@/lib/signals";
import { assertSameOrigin, clientKey, handle, ok, rateLimit } from "@/server/http";
import { recordSignal } from "@/server/recommend/signals";
import { getCurrentUserId } from "@/server/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  tmdbId: z.number().int().positive(),
  mediaType: z.enum(["movie", "tv"]),
  type: z.enum(SIGNAL_TYPES),
});

export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    rateLimit(clientKey(req, "signals"), 120, 60_000);
    const body = bodySchema.parse(await req.json());
    if (!isSignalType(body.type)) return ok({ ok: false });
    const userId = await getCurrentUserId();
    await recordSignal(userId, body);
    return ok({ ok: true });
  });
}
