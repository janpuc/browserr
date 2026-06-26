import "server-only";
import fs from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

export type DB = LibSQLDatabase<typeof schema>;

// Idempotent DDL — runs on first access. Keeps drizzle-kit optional for a
// zero-config homelab deploy. Column names mirror src/server/db/schema.ts.
const DDL = `
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  seerr_user_id INTEGER,
  display TEXT,
  created_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS services_cache (
  region TEXT NOT NULL,
  provider_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  logo_path TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  fetched_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (region, provider_id)
);
CREATE TABLE IF NOT EXISTS title_cache (
  tmdb_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  fetched_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tmdb_id, type)
);
CREATE TABLE IF NOT EXISTS signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  tmdb_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  media_type TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 0,
  ts INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS signals_user_idx ON signals (user_id, ts);
CREATE INDEX IF NOT EXISTS signals_user_title_idx ON signals (user_id, tmdb_id);
CREATE TABLE IF NOT EXISTS taste_profiles (
  user_id TEXT PRIMARY KEY,
  vector TEXT NOT NULL DEFAULT '{}',
  stats TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS rail_prefs (
  user_id TEXT PRIMARY KEY,
  "order" TEXT NOT NULL DEFAULT '[]',
  disabled TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS availability_cache (
  tmdb_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  status INTEGER NOT NULL DEFAULT 0,
  seasons TEXT,
  ts INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tmdb_id, type)
);
`;

/**
 * Translate a DATABASE_URL into a libsql connection URL.
 * DATABASE_URL is env/default only (never GUI-editable) to avoid a bootstrap
 * cycle with the settings table.
 */
export function toLibsqlUrl(databaseUrl: string): string {
  let u = (databaseUrl || "").trim();
  if (!u) return "file:./data/browserr.db";

  // Pass-through for remote/turso/explicit file URLs.
  if (/^(libsql|https?|wss?|file):/i.test(u)) return u;

  if (u.startsWith("postgres://") || u.startsWith("postgresql://")) {
    throw new Error(
      "Postgres is not supported in this build. Set DATABASE_URL to a sqlite:// path.",
    );
  }

  if (u.startsWith("sqlite:")) u = u.slice("sqlite:".length);
  if (u === ":memory:" || u.endsWith("/:memory:")) return ":memory:";
  // Drop the authority separator (`//`) if present: sqlite:///x → /x, sqlite://./x → ./x
  if (u.startsWith("//")) u = u.slice(2);

  const abs = path.isAbsolute(u) ? u : path.resolve(process.cwd(), u);
  try {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    return `file:${abs}`;
  } catch (err) {
    // The configured path isn't writable here (common locally when DATABASE_URL
    // points at the Docker volume `/data`). Self-heal to ./data so dev/CI works.
    const fallback = path.resolve(process.cwd(), "data", path.basename(abs) || "browserr.db");
    fs.mkdirSync(path.dirname(fallback), { recursive: true });
    console.warn(
      `[browserr] DATABASE_URL path "${abs}" is not writable (${(err as NodeJS.ErrnoException).code}); falling back to "${fallback}".`,
    );
    return `file:${fallback}`;
  }
}

interface Holder {
  client: Client;
  db: DB;
}

const globalForDb = globalThis as unknown as { __browserrDb?: Promise<Holder> };

async function init(): Promise<Holder> {
  const url = toLibsqlUrl(process.env.DATABASE_URL ?? "sqlite://./data/browserr.db");
  const client = createClient({ url });
  await client.executeMultiple(DDL);
  const db = drizzle(client, { schema });
  return { client, db };
}

function holder(): Promise<Holder> {
  if (!globalForDb.__browserrDb) {
    // Don't cache a rejected init — clear it so the next call can retry.
    globalForDb.__browserrDb = init().catch((err) => {
      globalForDb.__browserrDb = undefined;
      throw err;
    });
  }
  return globalForDb.__browserrDb;
}

export async function getDb(): Promise<DB> {
  return (await holder()).db;
}

export async function getRawClient(): Promise<Client> {
  return (await holder()).client;
}

export { schema };
