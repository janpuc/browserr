/**
 * Shared configuration schema + helpers.
 *
 * This module is import-safe from both client and server (no secrets, no node
 * built-ins). Server-side resolution (env + DB precedence) lives in
 * `src/server/config.ts`. The browser only ever receives a `PublicConfig`
 * (see `toPublicConfig`) which omits every secret and the internal Seerr URL.
 */
import { z } from "zod";

export const REQUEST_MODES = ["redirect", "proxy"] as const;
export const AUTH_MODES = ["none", "seerr", "basic"] as const;
export const MONETIZATION_TYPES = ["flatrate", "free", "ads", "rent", "buy"] as const;
export const THEMES = ["dark", "light"] as const;

export type RequestMode = (typeof REQUEST_MODES)[number];
export type AuthMode = (typeof AUTH_MODES)[number];
export type MonetizationType = (typeof MONETIZATION_TYPES)[number];
export type Theme = (typeof THEMES)[number];

/** The fully-resolved server configuration (includes secrets). */
export interface BrowserrConfig {
  core: {
    publicUrl: string;
    tz: string;
    /** When true, env is authoritative and the GUI is read-only. */
    lockConfig: boolean;
  };
  tmdb: {
    apiKey: string;
    accessToken: string;
    language: string;
  };
  seerr: {
    /** Server-to-server base URL. MUST NOT leak to the client. */
    internalUrl: string;
    /** Browser-facing base URL used to build redirect deep links. */
    externalUrl: string;
    apiKey: string;
    requestMode: RequestMode;
  };
  region: {
    region: string;
    /** TMDB watch-provider IDs the user subscribes to; empty = all in region. */
    services: number[];
    monetizationTypes: MonetizationType[];
  };
  auth: {
    mode: AuthMode;
    sessionSecret: string;
    basicUser: string;
    basicPass: string;
  };
  data: {
    databaseUrl: string;
    redisUrl: string;
  };
  recs: {
    enableRecommendations: boolean;
    enableEmbeddings: boolean;
    refreshCron: string;
  };
  features: {
    enableLibraryRails: boolean;
    enableTrailerAutoplay: boolean;
    heroRotateSeconds: number;
  };
  appearance: {
    theme: Theme;
    accent: string;
  };
}

/** Built-in defaults — the lowest precedence layer. */
export function defaultConfig(): BrowserrConfig {
  return {
    core: { publicUrl: "http://localhost:3000", tz: "UTC", lockConfig: false },
    tmdb: { apiKey: "", accessToken: "", language: "en-US" },
    seerr: {
      internalUrl: "",
      externalUrl: "",
      apiKey: "",
      requestMode: "redirect",
    },
    region: { region: "US", services: [], monetizationTypes: ["flatrate"] },
    auth: { mode: "none", sessionSecret: "", basicUser: "", basicPass: "" },
    // Relative by default so `npm run dev` works out of the box; Docker/compose
    // overrides this to the absolute volume path `sqlite:///data/browserr.db`.
    data: { databaseUrl: "sqlite://./data/browserr.db", redisUrl: "" },
    recs: { enableRecommendations: true, enableEmbeddings: false, refreshCron: "0 */6 * * *" },
    features: { enableLibraryRails: true, enableTrailerAutoplay: true, heroRotateSeconds: 12 },
    appearance: { theme: "dark", accent: "0 72% 51%" },
  };
}

/**
 * The settings the GUI may edit. Every field is optional; a PUT merges a partial
 * patch over the persisted settings. Secrets sent as the empty string are
 * treated as "leave unchanged" by the server (see applySettingsPatch).
 */
export const settingsPatchSchema = z
  .object({
    core: z
      .object({
        publicUrl: z.string().url().or(z.literal("")),
        tz: z.string().min(1),
      })
      .partial(),
    tmdb: z
      .object({
        apiKey: z.string(),
        accessToken: z.string(),
        language: z.string().min(2),
      })
      .partial(),
    seerr: z
      .object({
        internalUrl: z.string().url().or(z.literal("")),
        externalUrl: z.string().url().or(z.literal("")),
        apiKey: z.string(),
        requestMode: z.enum(REQUEST_MODES),
      })
      .partial(),
    region: z
      .object({
        region: z.string().length(2),
        services: z.array(z.number().int().positive()),
        monetizationTypes: z.array(z.enum(MONETIZATION_TYPES)),
      })
      .partial(),
    recs: z
      .object({
        enableRecommendations: z.boolean(),
        enableEmbeddings: z.boolean(),
      })
      .partial(),
    features: z
      .object({
        enableLibraryRails: z.boolean(),
        enableTrailerAutoplay: z.boolean(),
        heroRotateSeconds: z.number().int().min(0).max(120),
      })
      .partial(),
    appearance: z
      .object({
        theme: z.enum(THEMES),
        accent: z.string().min(1),
      })
      .partial(),
  })
  .partial();

export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

/** A deep-partial of BrowserrConfig, as persisted in the DB settings row. */
export type StoredSettings = SettingsPatch;

/** Recursively merge a partial patch over a base config. Arrays are replaced. */
export function deepMergeConfig<T>(base: T, patch: unknown): T {
  if (patch === undefined || patch === null) return base;
  if (Array.isArray(base) || typeof base !== "object") {
    return patch as T;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    if (value === undefined) continue;
    const baseVal = (base as Record<string, unknown>)[key];
    if (
      baseVal !== null &&
      typeof baseVal === "object" &&
      !Array.isArray(baseVal) &&
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      out[key] = deepMergeConfig(baseVal, value);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

/**
 * Client-safe projection of the resolved config. Contains NO secrets and NOT
 * the internal Seerr URL. Booleans expose whether a credential is configured so
 * the Settings UI can render "configured / not configured" without the value.
 */
export interface PublicConfig {
  core: { publicUrl: string; tz: string; lockConfig: boolean; version: string };
  tmdb: { language: string; hasKey: boolean; configured: boolean };
  seerr: {
    externalUrl: string;
    requestMode: RequestMode;
    hasKey: boolean;
    configured: boolean;
  };
  region: { region: string; services: number[]; monetizationTypes: MonetizationType[] };
  auth: { mode: AuthMode };
  recs: { enableRecommendations: boolean; enableEmbeddings: boolean };
  features: {
    enableLibraryRails: boolean;
    enableTrailerAutoplay: boolean;
    heroRotateSeconds: number;
  };
  appearance: { theme: Theme; accent: string };
}

export function toPublicConfig(cfg: BrowserrConfig, version: string): PublicConfig {
  return {
    core: {
      publicUrl: cfg.core.publicUrl,
      tz: cfg.core.tz,
      lockConfig: cfg.core.lockConfig,
      version,
    },
    tmdb: {
      language: cfg.tmdb.language,
      hasKey: Boolean(cfg.tmdb.apiKey || cfg.tmdb.accessToken),
      configured: Boolean(cfg.tmdb.apiKey || cfg.tmdb.accessToken),
    },
    seerr: {
      externalUrl: cfg.seerr.externalUrl,
      requestMode: cfg.seerr.requestMode,
      hasKey: Boolean(cfg.seerr.apiKey),
      configured: Boolean(cfg.seerr.internalUrl && cfg.seerr.apiKey),
    },
    region: {
      region: cfg.region.region,
      services: cfg.region.services,
      monetizationTypes: cfg.region.monetizationTypes,
    },
    auth: { mode: cfg.auth.mode },
    recs: {
      enableRecommendations: cfg.recs.enableRecommendations,
      enableEmbeddings: cfg.recs.enableEmbeddings,
    },
    features: { ...cfg.features },
    appearance: { ...cfg.appearance },
  };
}
