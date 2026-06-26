import "server-only";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { NEGATIVE_HIDE, SIGNAL_WEIGHTS, type SignalType } from "@/lib/signals";
import type { MediaType } from "@/lib/types";
import { getDb } from "../db";
import { signals as signalsTable, tasteProfiles } from "../db/schema";
import { applySignalIncremental } from "./profile";

export interface SignalInput {
  tmdbId: number;
  mediaType: MediaType;
  type: SignalType;
}

export async function recordSignal(userId: string, input: SignalInput): Promise<void> {
  const weight = SIGNAL_WEIGHTS[input.type];
  const db = await getDb();
  await db.insert(signalsTable).values({
    userId,
    tmdbId: input.tmdbId,
    mediaType: input.mediaType,
    type: input.type,
    weight,
    ts: Date.now(),
  });
  // Immediately fold the signal into the profile so recs shift on interaction.
  if (weight !== 0) {
    await applySignalIncremental(userId, input.tmdbId, input.mediaType, weight);
  }
}

/** Titles the user marked "not interested"/hidden — excluded from rails. */
export async function getHiddenTitleIds(userId: string): Promise<Set<number>> {
  const db = await getDb();
  const rows = await db
    .select({ tmdbId: signalsTable.tmdbId })
    .from(signalsTable)
    .where(
      and(
        eq(signalsTable.userId, userId),
        inArray(signalsTable.type, [...NEGATIVE_HIDE]),
      ),
    );
  return new Set(rows.map((r) => r.tmdbId));
}

export interface StrongSignal {
  tmdbId: number;
  mediaType: MediaType;
  ts: number;
}

/** Recent strong-positive titles, deduped, to seed "Because you watched X". */
export async function getRecentStrongSignals(
  userId: string,
  limit = 6,
): Promise<StrongSignal[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(signalsTable)
    .where(and(eq(signalsTable.userId, userId), gte(signalsTable.weight, 3)))
    .orderBy(desc(signalsTable.ts))
    .limit(80);

  const seen = new Set<number>();
  const out: StrongSignal[] = [];
  for (const r of rows) {
    if (seen.has(r.tmdbId)) continue;
    seen.add(r.tmdbId);
    out.push({ tmdbId: r.tmdbId, mediaType: r.mediaType as MediaType, ts: r.ts });
    if (out.length >= limit) break;
  }
  return out;
}

/** Titles already watched/requested — not re-recommended in taste rails. */
export async function getConsumedTitleIds(userId: string): Promise<Set<number>> {
  const db = await getDb();
  const rows = await db
    .select({ tmdbId: signalsTable.tmdbId })
    .from(signalsTable)
    .where(
      and(
        eq(signalsTable.userId, userId),
        inArray(signalsTable.type, ["watched", "request"]),
      ),
    );
  return new Set(rows.map((r) => r.tmdbId));
}

/** "Forget me" — wipe signals + taste profile for the user. */
export async function clearUserSignals(userId: string): Promise<void> {
  const db = await getDb();
  await db.delete(signalsTable).where(eq(signalsTable.userId, userId));
  await db.delete(tasteProfiles).where(eq(tasteProfiles.userId, userId));
}
