import { getConfig } from "@/server/config";
import { instanceFacts, redactedConfig, securityNotes } from "@/server/diagnostics";
import { assertSameOrigin, clientKey, handle, ok, rateLimit } from "@/server/http";
import { recentLogs } from "@/server/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sanitized diagnostics for the Settings "Export" button (secrets redacted). */
export async function GET(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    rateLimit(clientKey(req, "diagnostics"), 10, 60_000);
    const cfg = await getConfig();
    return ok({
      generatedAt: new Date().toISOString(),
      facts: instanceFacts(cfg),
      config: redactedConfig(cfg),
      security: securityNotes(cfg),
      logs: recentLogs(),
      note: "Secrets, API keys, and the internal Seerr URL are redacted. Review before sharing.",
    });
  });
}
