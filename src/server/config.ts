import "server-only";
import { eq } from "drizzle-orm";
import {
  defaultConfig,
  deepMergeConfig,
  settingsPatchSchema,
  toPublicConfig,
  type BrowserrConfig,
  type PublicConfig,
  type SettingsPatch,
  type StoredSettings,
} from "@/lib/config";
import pkg from "../../package.json";
import { getDb } from "./db";
import { settings as settingsTable } from "./db/schema";
import { readEnvConfig } from "./env";
import { log } from "./log";

// Single source of truth is package.json; CI injects BROWSERR_VERSION from the
// git tag (releases) or short SHA (edge builds) to override at build time.
export const VERSION = process.env.BROWSERR_VERSION || pkg.version;
const GLOBAL = "global";

/**
 * Secret fields that the GUI sends masked. When a patch carries the empty string
 * for one of these we treat it as "leave unchanged" so saving Settings never
 * blanks a credential that the form rendered as ●●●●.
 */
const SECRET_PATHS: ReadonlyArray<[keyof StoredSettings, string]> = [
  ["tmdb", "apiKey"],
  ["tmdb", "accessToken"],
  ["seerr", "apiKey"],
  // Internal URL is write-only in the GUI (never sent to the client), so an
  // empty submit means "leave unchanged" just like a secret.
  ["seerr", "internalUrl"],
];

export class ConfigLockedError extends Error {
  constructor() {
    super("Configuration is locked by LOCK_CONFIG; edit via environment variables instead.");
    this.name = "ConfigLockedError";
  }
}

// Settings change rarely; cache the resolved global DB layer and invalidate on save.
let cachedGlobal: StoredSettings | null = null;

async function loadStored(id: string): Promise<StoredSettings> {
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.id, id))
      .limit(1);
    return (rows[0]?.data as StoredSettings) ?? {};
  } catch (err) {
    // Resilience: a DB hiccup must not take down config resolution — fall back
    // to env/defaults so the app still boots and the catalog still browses.
    log.error("failed to load settings; using env/defaults", { id, err: String(err) });
    return {};
  }
}

/**
 * Resolve the effective configuration.
 * Precedence: defaults → env → DB global → DB per-user (last wins).
 * When LOCK_CONFIG is set (via env/defaults), the DB layers are skipped entirely.
 *
 * Note: env is treated as a live default layer rather than being copied into the
 * DB, so changing env still takes effect and the DB holds only explicit GUI
 * overrides — which is exactly "env seeds defaults; GUI overrides env".
 */
export async function getConfig(userId?: string): Promise<BrowserrConfig> {
  const env = readEnvConfig();
  let cfg = deepMergeConfig(defaultConfig(), env);

  if (!cfg.core.lockConfig) {
    if (cachedGlobal === null) cachedGlobal = await loadStored(GLOBAL);
    cfg = deepMergeConfig(cfg, cachedGlobal);
    if (userId && userId !== GLOBAL) {
      const perUser = await loadStored(`user:${userId}`);
      cfg = deepMergeConfig(cfg, perUser);
    }
  }
  return cfg;
}

export async function getPublicConfig(userId?: string): Promise<PublicConfig> {
  return toPublicConfig(await getConfig(userId), VERSION);
}

function stripUnchangedSecrets(patch: SettingsPatch): SettingsPatch {
  const clone = structuredClone(patch) as Record<string, Record<string, unknown>>;
  for (const [section, key] of SECRET_PATHS) {
    const sec = clone[section as string];
    if (sec && sec[key] === "") delete sec[key];
  }
  return clone as SettingsPatch;
}

/**
 * Validate + persist a settings patch for a scope ("global" or "user:<id>").
 * Returns the freshly-resolved config. Throws ConfigLockedError if locked.
 */
export async function saveSettings(
  rawPatch: unknown,
  scope: string = GLOBAL,
): Promise<BrowserrConfig> {
  const current = await getConfig();
  if (current.core.lockConfig) throw new ConfigLockedError();

  const patch = settingsPatchSchema.parse(rawPatch);
  const clean = stripUnchangedSecrets(patch);

  const stored = await loadStored(scope);
  const merged = deepMergeConfig(stored, clean) as StoredSettings;

  const db = await getDb();
  const now = Date.now();
  await db
    .insert(settingsTable)
    .values({ id: scope, data: merged, updatedAt: now })
    .onConflictDoUpdate({ target: settingsTable.id, set: { data: merged, updatedAt: now } });

  if (scope === GLOBAL) cachedGlobal = merged;
  log.info("settings saved", { scope, sections: Object.keys(clean) });
  return getConfig(scope === GLOBAL ? undefined : scope.replace(/^user:/, ""));
}

/** Drop persisted overrides for a scope (used by reset controls). */
export async function clearSettings(scope: string = GLOBAL): Promise<void> {
  const db = await getDb();
  await db.delete(settingsTable).where(eq(settingsTable.id, scope));
  if (scope === GLOBAL) cachedGlobal = null;
}

/** Test-only / cron hook to force a re-read of the cached DB layer. */
export function invalidateConfigCache(): void {
  cachedGlobal = null;
}
