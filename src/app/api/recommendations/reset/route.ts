import { cacheClearPrefix } from "@/server/cache";
import { assertSameOrigin, handle, ok } from "@/server/http";
import { clearUserSignals } from "@/server/recommend/signals";
import { getCurrentUserId } from "@/server/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reset/forget control: wipe signals + taste profile for transparency (§8). */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const userId = await getCurrentUserId();
    await clearUserSignals(userId);
    cacheClearPrefix("recs:");
    return ok({ ok: true });
  });
}
