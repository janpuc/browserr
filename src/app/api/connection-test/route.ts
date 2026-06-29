import { z } from "zod";
import { getConfig } from "@/server/config";
import { assertSameOrigin, clientKey, handle, HttpError, ok, rateLimit } from "@/server/http";
import { SeerrClient } from "@/server/seerr/client";
import { TmdbClient } from "@/server/tmdb/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  target: z.enum(["tmdb", "seerr"]),
  // Optional override creds so the form can test before saving. Omitted => use
  // the currently resolved config.
  apiKey: z.string().optional(),
  accessToken: z.string().optional(),
  internalUrl: z.string().optional(),
});

/** Test TMDB / Seerr connectivity with provided or current credentials. */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    rateLimit(clientKey(req, "conn-test"), 20, 60_000);
    const body = bodySchema.parse(await req.json());
    const cfg = await getConfig();

    if (body.target === "tmdb") {
      const client = new TmdbClient({
        apiKey: body.apiKey ?? cfg.tmdb.apiKey,
        accessToken: body.accessToken ?? cfg.tmdb.accessToken,
        language: cfg.tmdb.language,
      });
      if (!client.isConfigured()) throw new HttpError(400, "No TMDB credentials provided");
      const regions = await client.getRegions();
      return ok({ ok: true, detail: `TMDB reachable - ${regions.length} regions available` });
    }

    const internalUrl = body.internalUrl ?? cfg.seerr.internalUrl;
    const apiKey = body.apiKey ?? cfg.seerr.apiKey;
    const client = new SeerrClient(internalUrl, apiKey);
    if (!client.isConfigured()) throw new HttpError(400, "Seerr internal URL and API key required");
    // (the SSRF guard runs inside SeerrClient.call)
    const status = await client.status();
    return ok({ ok: true, detail: `Seerr reachable${status.version ? ` - v${status.version}` : ""}` });
  });
}
