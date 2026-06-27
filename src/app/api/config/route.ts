import { getPublicConfig, saveSettings } from "@/server/config";
import { cacheClearPrefix } from "@/server/cache";
import { assertSameOrigin, handle, ok } from "@/server/http";
import { getCurrentUserId } from "@/server/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const userId = await getCurrentUserId();
    return ok(await getPublicConfig(userId));
  });
}

export async function PUT(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const body = await req.json().catch(() => ({}));
    await saveSettings(body);

    // Region/service changes must re-derive the catalog - drop dependent caches.
    if (body?.region) {
      cacheClearPrefix("region:");
      cacheClearPrefix("tmdb:/discover");
      cacheClearPrefix("recs:");
    }
    return ok(await getPublicConfig());
  });
}
