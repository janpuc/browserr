import "server-only";

type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[(process.env.LOG_LEVEL as Level) || "info"] ?? LEVELS.info;

// In-memory ring buffer of recent lines for the diagnostics export.
const RING_MAX = 200;
const ring: string[] = [];

/** Recent log lines (oldest first) for the diagnostics export. */
export function recentLogs(limit = RING_MAX): string[] {
  return ring.slice(-limit);
}

function emit(level: Level, msg: string, meta?: Record<string, unknown>) {
  if (LEVELS[level] < threshold) return;
  const line = {
    t: new Date().toISOString(),
    level,
    scope: "browserr",
    msg,
    ...(meta ?? {}),
  };
  const json = JSON.stringify(line);
  ring.push(json);
  if (ring.length > RING_MAX) ring.shift();
  const out = level === "error" || level === "warn" ? console.error : console.log;
  // Structured single-line JSON for easy ingestion; readable enough in dev.
  out(json);
}

export const log = {
  debug: (msg: string, meta?: Record<string, unknown>) => emit("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => emit("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit("error", msg, meta),
};
