import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { StoredSettings } from "@/lib/config";
import { getConfig, VERSION } from "./config";
import { getDb } from "./db";
import { settings as settingsTable } from "./db/schema";
import { log } from "./log";

/**
 * Anonymous, opt-out install telemetry. Each instance has one random UUID
 * (persisted in the settings table) and sends at most one heartbeat per day with
 * just that id + the running version. No IP, no user data, no content. Disable
 * with BROWSERR_TELEMETRY=false. Every path here is best-effort and never throws:
 * telemetry must never affect the app.
 */
const ROW_ID = "telemetry";
const DAY_MS = 24 * 60 * 60 * 1000;
const PING_TIMEOUT_MS = 5_000;

interface TelemetryState {
  instanceId: string;
  lastSent?: number;
}

async function loadState(): Promise<TelemetryState | null> {
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.id, ROW_ID))
      .limit(1);
    const data = rows[0]?.data as unknown as TelemetryState | undefined;
    return data?.instanceId ? data : null;
  } catch {
    return null;
  }
}

async function saveState(state: TelemetryState): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  const data = state as unknown as StoredSettings;
  await db
    .insert(settingsTable)
    .values({ id: ROW_ID, data, updatedAt: now })
    .onConflictDoUpdate({ target: settingsTable.id, set: { data, updatedAt: now } });
}

async function loadOrCreate(): Promise<TelemetryState> {
  const existing = await loadState();
  if (existing) return existing;
  const fresh: TelemetryState = { instanceId: randomUUID() };
  await saveState(fresh).catch(() => {});
  return fresh;
}

let announced = false;

/** Log a one-time, transparent notice of whether telemetry is on. */
export async function announceTelemetry(): Promise<void> {
  if (announced) return;
  announced = true;
  try {
    const cfg = await getConfig();
    if (cfg.telemetry.enabled && cfg.telemetry.url) {
      log.info(
        "anonymous install telemetry is ON (random instance id + version, once daily). Opt out with BROWSERR_TELEMETRY=false",
      );
    } else {
      log.info("install telemetry is off");
    }
  } catch {
    /* ignore */
  }
}

/** Best-effort daily heartbeat. Safe to call on every cron tick (it self-throttles). */
export async function sendHeartbeat(): Promise<void> {
  let cfg;
  try {
    cfg = await getConfig();
  } catch {
    return;
  }
  if (!cfg.telemetry.enabled || !cfg.telemetry.url) return;

  const state = await loadOrCreate();
  if (state.lastSent && Date.now() - state.lastSent < DAY_MS) return;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PING_TIMEOUT_MS);
  try {
    await fetch(cfg.telemetry.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: state.instanceId, version: VERSION }),
      signal: ctrl.signal,
    });
    await saveState({ ...state, lastSent: Date.now() });
  } catch {
    /* swallow - never surface a telemetry error */
  } finally {
    clearTimeout(timer);
  }
}
