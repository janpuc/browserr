import { z } from "zod";
import { assertSameOrigin, clientKey, handle, ok, rateLimit } from "@/server/http";
import { getSeerr } from "@/server/seerr/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        id: z.number().int().positive(),
        mediaType: z.enum(["movie", "tv"]),
      }),
    )
    .max(60),
});

/** Batch availability lookup - used to hydrate badges progressively after paint. */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    rateLimit(clientKey(req, "availability"), 60, 60_000);
    const body = bodySchema.parse(await req.json());
    const seerr = await getSeerr();
    const result = await seerr.getAvailabilityBatch(body.items);
    return ok({ availability: result });
  });
}
