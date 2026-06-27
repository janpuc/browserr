import "server-only";
import type { AuthMode, MonetizationType, RequestMode, Theme } from "@/lib/config";
import {
  AUTH_MODES,
  MONETIZATION_TYPES,
  REQUEST_MODES,
  THEMES,
  type BrowserrConfig,
} from "@/lib/config";

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

function bool(v: string | undefined, fallback?: boolean): boolean | undefined {
  if (v === undefined || v === "") return fallback;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

function int(v: string | undefined): number | undefined {
  if (v === undefined || v === "") return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

function csvInts(v: string | undefined): number[] | undefined {
  if (v === undefined) return undefined;
  const ids = v
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return ids; // empty array is meaningful ("all in region")
}

function csvEnum<T extends string>(v: string | undefined, allowed: readonly T[]): T[] | undefined {
  if (v === undefined || v === "") return undefined;
  const vals = v
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is T => (allowed as readonly string[]).includes(s));
  return vals.length ? vals : undefined;
}

function oneOf<T extends string>(v: string | undefined, allowed: readonly T[]): T | undefined {
  if (v === undefined) return undefined;
  const lower = v.trim().toLowerCase();
  return (allowed as readonly string[]).includes(lower) ? (lower as T) : undefined;
}

function str(v: string | undefined): string | undefined {
  return v === undefined ? undefined : v;
}

/** Strip undefined leaves so the result is a clean sparse patch. */
function prune<T>(obj: T): DeepPartial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (v === undefined) continue;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      const nested = prune(v);
      if (Object.keys(nested as object).length) out[k] = nested;
    } else {
      out[k] = v;
    }
  }
  return out as DeepPartial<T>;
}

/**
 * Read process.env into a sparse partial config. Only keys that are actually
 * present produce an override, so env layers cleanly over the defaults.
 */
export function readEnvConfig(): DeepPartial<BrowserrConfig> {
  const e = process.env;
  const partial: DeepPartial<BrowserrConfig> = {
    core: {
      publicUrl: str(e.PUBLIC_URL),
      tz: str(e.TZ),
      lockConfig: bool(e.LOCK_CONFIG),
    },
    tmdb: {
      apiKey: str(e.TMDB_API_KEY),
      accessToken: str(e.TMDB_ACCESS_TOKEN),
      language: str(e.TMDB_LANGUAGE),
    },
    seerr: {
      internalUrl: str(e.SEERR_INTERNAL_URL),
      externalUrl: str(e.SEERR_EXTERNAL_URL),
      apiKey: str(e.SEERR_API_KEY),
      requestMode: oneOf<RequestMode>(e.SEERR_REQUEST_MODE, REQUEST_MODES),
    },
    region: {
      region: e.DEFAULT_REGION ? e.DEFAULT_REGION.toUpperCase() : undefined,
      services: csvInts(e.DEFAULT_SERVICES),
      monetizationTypes: csvEnum<MonetizationType>(e.MONETIZATION_TYPES, MONETIZATION_TYPES),
    },
    auth: {
      mode: oneOf<AuthMode>(e.AUTH_MODE, AUTH_MODES),
      sessionSecret: str(e.SESSION_SECRET),
      basicUser: str(e.BASIC_AUTH_USER),
      basicPass: str(e.BASIC_AUTH_PASS),
    },
    data: {
      databaseUrl: str(e.DATABASE_URL),
      redisUrl: str(e.REDIS_URL),
    },
    recs: {
      enableRecommendations: bool(e.ENABLE_RECOMMENDATIONS),
      enableEmbeddings: bool(e.ENABLE_EMBEDDINGS),
      refreshCron: str(e.RECS_REFRESH_CRON),
    },
    features: {
      enableLibraryRails: bool(e.ENABLE_LIBRARY_RAILS),
      heroRotateSeconds: int(e.HERO_ROTATE_SECONDS),
    },
    appearance: {
      theme: oneOf<Theme>(e.BROWSERR_THEME, THEMES),
      accent: str(e.BROWSERR_ACCENT),
    },
  };
  return prune(partial);
}
