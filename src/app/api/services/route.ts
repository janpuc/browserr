import { getConfig } from "@/server/config";
import { handle, ok } from "@/server/http";
import { listRegionServices } from "@/server/region";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The set of services that exist in a region. `?region=XX` overrides the
 * configured region so the Settings picker can preview a region before saving.
 */
export async function GET(req: Request) {
  return handle(async () => {
    const url = new URL(req.url);
    const region = (url.searchParams.get("region") || (await getConfig()).region.region).toUpperCase();
    const services = await listRegionServices(region);
    return ok({ region, services });
  });
}
