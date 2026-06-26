import { handle, ok } from "@/server/http";
import { listRegions } from "@/server/region";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => ok(await listRegions()));
}
