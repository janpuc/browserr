import "server-only";
import { existsSync, readFileSync } from "node:fs";
import type { BrowserrConfig } from "@/lib/config";
import { VERSION } from "./config";

export type Runtime = "kubernetes" | "docker" | "node";

let cachedRuntime: Runtime | undefined;

/** Best-effort detection of how the process is running. Never throws. */
export function detectRuntime(): Runtime {
  if (cachedRuntime) return cachedRuntime;
  let rt: Runtime = "node";
  try {
    if (process.env.KUBERNETES_SERVICE_HOST) rt = "kubernetes";
    else if (existsSync("/.dockerenv")) rt = "docker";
    else if (/docker|containerd|kubepods/.test(readFileSync("/proc/1/cgroup", "utf8"))) rt = "docker";
  } catch {
    /* default to node */
  }
  cachedRuntime = rt;
  return rt;
}

/**
 * Non-PII facts (runtime shape + which features/modes are on) shared by the
 * telemetry heartbeat and the diagnostics export. No secrets, URLs, keys, or IPs.
 */
export function instanceFacts(cfg: BrowserrConfig) {
  return {
    version: VERSION,
    runtime: detectRuntime(),
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    authMode: cfg.auth.mode,
    requestMode: cfg.seerr.requestMode,
    lockConfig: cfg.core.lockConfig,
    tmdbConfigured: Boolean(cfg.tmdb.apiKey || cfg.tmdb.accessToken),
    seerrConfigured: Boolean(cfg.seerr.internalUrl && cfg.seerr.apiKey),
    db: cfg.data.databaseUrl.split("://")[0] || "sqlite", // scheme only, never the path
    redis: Boolean(cfg.data.redisUrl),
    region: cfg.region.region,
    services: cfg.region.services.length,
    monetization: cfg.region.monetizationTypes,
    recommendations: cfg.recs.enableRecommendations,
    embeddings: cfg.recs.enableEmbeddings,
    libraryRails: cfg.features.enableLibraryRails,
    theme: cfg.appearance.theme,
  } as const;
}

export type InstanceFacts = ReturnType<typeof instanceFacts>;

const mask = (v: string): "set" | "not set" => (v ? "set" : "not set");

/** Redacted config for the Settings export: secrets + the internal URL become `set`/`not set`. */
export function redactedConfig(cfg: BrowserrConfig) {
  return {
    core: { publicUrl: cfg.core.publicUrl, tz: cfg.core.tz, lockConfig: cfg.core.lockConfig },
    tmdb: { language: cfg.tmdb.language, apiKey: mask(cfg.tmdb.apiKey), accessToken: mask(cfg.tmdb.accessToken) },
    seerr: {
      internalUrl: mask(cfg.seerr.internalUrl), // never reveal the internal URL
      externalUrl: cfg.seerr.externalUrl,
      apiKey: mask(cfg.seerr.apiKey),
      requestMode: cfg.seerr.requestMode,
    },
    region: cfg.region,
    auth: {
      mode: cfg.auth.mode,
      sessionSecret: mask(cfg.auth.sessionSecret),
      basicUser: mask(cfg.auth.basicUser),
      basicPass: mask(cfg.auth.basicPass),
    },
    data: { db: cfg.data.databaseUrl.split("://")[0] || "sqlite", redis: mask(cfg.data.redisUrl) },
    recs: cfg.recs,
    features: cfg.features,
    appearance: cfg.appearance,
    telemetry: { enabled: cfg.telemetry.enabled, url: mask(cfg.telemetry.url) },
  };
}

/** "Is this exposed insecurely?" hints surfaced in the export. */
export function securityNotes(cfg: BrowserrConfig): string[] {
  const notes: string[] = [];
  if (cfg.auth.mode === "none") {
    notes.push("AUTH_MODE=none: Settings and connection tests are unauthenticated - only expose this on a trusted network or behind your own auth/reverse proxy.");
  }
  if (!cfg.core.lockConfig && cfg.auth.mode === "none") {
    notes.push("LOCK_CONFIG=false with AUTH_MODE=none: anyone who can reach the app can change configuration.");
  }
  if (cfg.core.publicUrl.startsWith("http://") && !cfg.core.publicUrl.includes("localhost")) {
    notes.push("PUBLIC_URL is http:// (not https) - terminate TLS at a reverse proxy for anything internet-facing.");
  }
  return notes;
}
