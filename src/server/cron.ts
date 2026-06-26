import "server-only";
import { getConfig } from "./config";
import { log } from "./log";
import { recomputeProfile } from "./recommend/profile";
import { listRegionServices } from "./region";
import { DEFAULT_USER_ID } from "./user";

/** Best-effort parse of "0 *​/N * * *" → N hours; defaults to 6h. */
function intervalHoursFromCron(cron: string): number {
  const m = cron.trim().match(/^\S+\s+\*\/(\d+)\s+\*\s+\*\s+\*$/);
  if (m) {
    const n = Number.parseInt(m[1], 10);
    if (n > 0 && n <= 24) return n;
  }
  return 6;
}

let started = false;

/**
 * Lightweight in-process refresher (no node-cron dependency): pre-warm provider
 * catalogs and recompute taste profiles on the configured cadence. Errors are
 * swallowed so a missing TMDB key just means the job no-ops until configured.
 */
export function startCron(): void {
  if (started) return;
  started = true;

  const run = async () => {
    try {
      const cfg = await getConfig();
      await listRegionServices(cfg.region.region);
      if (cfg.recs.enableRecommendations) {
        await recomputeProfile(DEFAULT_USER_ID).catch(() => {});
      }
      log.info("cron refresh complete");
    } catch (err) {
      log.warn("cron refresh failed", { err: String(err) });
    }
  };

  // Warm shortly after boot, then on the configured interval.
  setTimeout(run, 20_000);
  getConfig()
    .then((cfg) => {
      const hours = intervalHoursFromCron(cfg.recs.refreshCron);
      setInterval(run, hours * 3_600_000);
      log.info("cron scheduled", { hours });
    })
    .catch(() => setInterval(run, 6 * 3_600_000));
}
