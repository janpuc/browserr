import type { Config } from "drizzle-kit";

// Browserr bootstraps its schema at runtime via idempotent CREATE TABLE IF NOT
// EXISTS (see src/server/db/index.ts), so drizzle-kit is optional. This config
// is provided for `db:generate` / `db:push` during development.
export default {
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL?.replace(/^sqlite:\/\//, "file:") ?? "file:./data/browserr.db",
  },
} satisfies Config;
