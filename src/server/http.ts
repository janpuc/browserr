import "server-only";
import { NextResponse } from "next/server";
import { ConfigLockedError } from "./config";
import { log } from "./log";
import { SeerrNotConfiguredError } from "./seerr/client";
import { TmdbError, TmdbNotConfiguredError } from "./tmdb/client";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function fail(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Reject cross-origin mutations (lightweight CSRF guard for the same-origin SPA). */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  if (!origin) return; // same-origin GETs and server-to-server calls omit Origin
  const host = req.headers.get("host");
  try {
    if (host && new URL(origin).host !== host) {
      throw new HttpError(403, "Cross-origin request blocked");
    }
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(403, "Invalid origin");
  }
}

// ── Tiny fixed-window rate limiter for the BFF (per key) ──────────────────────
const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return;
  }
  b.count++;
  if (b.count > limit) throw new HttpError(429, "Too many requests");
}

export function clientKey(req: Request, scope: string): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  return `${scope}:${ip}`;
}

/** Wrap a handler, mapping known errors to status codes and logging the rest. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) return fail(err.status, err.message);
    if (err instanceof ConfigLockedError) return fail(423, err.message);
    if (err instanceof TmdbNotConfiguredError || err instanceof SeerrNotConfiguredError) {
      return fail(503, err.message);
    }
    if (err instanceof TmdbError) return fail(502, err.message);
    if (err && typeof err === "object" && "issues" in err) {
      // ZodError
      return fail(400, "Invalid request body");
    }
    log.error("unhandled route error", { err: String(err) });
    return fail(500, "Internal error");
  }
}
