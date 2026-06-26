import { handle, ok } from "@/server/http";
import { buildHomeFeed } from "@/server/rails/generators";
import { getCurrentUserId } from "@/server/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(async () => {
    const raw = Number.parseInt(new URL(req.url).searchParams.get("v") ?? "0", 10);
    const userId = await getCurrentUserId();
    return ok(await buildHomeFeed(userId, Number.isFinite(raw) ? raw : 0));
  });
}
