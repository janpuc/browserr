import { handle, ok } from "@/server/http";
import { buildHomeFeed } from "@/server/rails/generators";
import { getCurrentUserId } from "@/server/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const userId = await getCurrentUserId();
    return ok(await buildHomeFeed(userId));
  });
}
