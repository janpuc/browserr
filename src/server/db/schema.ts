import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { StoredSettings } from "@/lib/config";

/**
 * Settings rows. `id = "global"` holds the singleton global settings; per-user
 * overrides are stored under `id = "user:<userId>"` and deep-merged on top.
 */
export const settings = sqliteTable("settings", {
  id: text("id").primaryKey(),
  data: text("data", { mode: "json" }).$type<StoredSettings>().notNull().default({}),
  updatedAt: integer("updated_at").notNull().default(0),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  seerrUserId: integer("seerr_user_id"),
  display: text("display"),
  createdAt: integer("created_at").notNull().default(0),
});

/** Watch-provider catalog per region, refreshed by the cron job (long TTL). */
export const servicesCache = sqliteTable(
  "services_cache",
  {
    region: text("region").notNull(),
    providerId: integer("provider_id").notNull(),
    name: text("name").notNull(),
    logoPath: text("logo_path"),
    priority: integer("priority").notNull().default(0),
    fetchedAt: integer("fetched_at").notNull().default(0),
  },
  (t) => ({ pk: primaryKey({ columns: [t.region, t.providerId] }) }),
);

/** Raw TMDB payload cache keyed by tmdb id + media type. */
export const titleCache = sqliteTable(
  "title_cache",
  {
    tmdbId: integer("tmdb_id").notNull(),
    type: text("type", { enum: ["movie", "tv"] }).notNull(),
    payload: text("payload", { mode: "json" }).notNull(),
    fetchedAt: integer("fetched_at").notNull().default(0),
  },
  (t) => ({ pk: primaryKey({ columns: [t.tmdbId, t.type] }) }),
);

/** Interaction signals that drive the taste profile (§8). */
export const signals = sqliteTable(
  "signals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    tmdbId: integer("tmdb_id").notNull(),
    type: text("type").notNull(),
    mediaType: text("media_type", { enum: ["movie", "tv"] }).notNull(),
    weight: integer("weight").notNull().default(0),
    ts: integer("ts").notNull().default(0),
  },
  (t) => ({
    byUser: index("signals_user_idx").on(t.userId, t.ts),
    byUserTitle: index("signals_user_title_idx").on(t.userId, t.tmdbId),
  }),
);

/** Per-user taste profile: a sparse feature→weight map (JSON) + scalar stats. */
export const tasteProfiles = sqliteTable("taste_profiles", {
  userId: text("user_id").primaryKey(),
  vector: text("vector", { mode: "json" }).$type<Record<string, number>>().notNull().default({}),
  stats: text("stats", { mode: "json" }).$type<Record<string, number>>().notNull().default({}),
  updatedAt: integer("updated_at").notNull().default(0),
});

/** Per-user rail ordering + enabled flags. */
export const railPrefs = sqliteTable("rail_prefs", {
  userId: text("user_id").primaryKey(),
  order: text("order", { mode: "json" }).$type<string[]>().notNull().default([]),
  disabled: text("disabled", { mode: "json" }).$type<string[]>().notNull().default([]),
  updatedAt: integer("updated_at").notNull().default(0),
});

/** Cached Seerr availability so badges never block initial render. */
export const availabilityCache = sqliteTable(
  "availability_cache",
  {
    tmdbId: integer("tmdb_id").notNull(),
    type: text("type", { enum: ["movie", "tv"] }).notNull(),
    status: integer("status").notNull().default(0),
    seasons: text("seasons", { mode: "json" }).$type<Record<number, number>>(),
    ts: integer("ts").notNull().default(0),
  },
  (t) => ({ pk: primaryKey({ columns: [t.tmdbId, t.type] }) }),
);

export const SCHEMA_SQL = sql; // re-exported for convenience in migrate()
