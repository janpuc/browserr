import { handle, ok } from "@/server/http";
import { buildExtraRails } from "@/server/rails/generators";
import { getCurrentUserId } from "@/server/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Paginated extended rails for infinite scroll (page starts at 1). */
export async function GET(req: Request) {
  return handle(async () => {
    const raw = Number.parseInt(new URL(req.url).searchParams.get("page") ?? "1", 10);
    const page = Number.isFinite(raw) && raw > 0 ? raw : 1;
    const userId = await getCurrentUserId();
    return ok(await buildExtraRails(userId, page));
  });
}
