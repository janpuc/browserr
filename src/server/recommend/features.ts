import "server-only";
import type { MediaDetail, MediaSummary } from "@/lib/types";

/** A sparse feature vector: token → weight. */
export type Vector = Record<string, number>;

function decadeToken(year: number | null): string | null {
  if (!year) return null;
  return `decade:${Math.floor(year / 10) * 10}`;
}

function runtimeBucket(runtime: number | null): string | null {
  if (!runtime) return null;
  if (runtime < 40) return "rt:short";
  if (runtime < 100) return "rt:medium";
  if (runtime < 150) return "rt:long";
  return "rt:epic";
}

/** L2 norm of a vector. */
export function norm(v: Vector): number {
  let s = 0;
  for (const k in v) s += v[k] * v[k];
  return Math.sqrt(s);
}

/** Return a unit-length copy so each title contributes equal magnitude. */
export function unit(v: Vector): Vector {
  const n = norm(v);
  if (n === 0) return {};
  const out: Vector = {};
  for (const k in v) out[k] = v[k] / n;
  return out;
}

export function addScaled(target: Vector, v: Vector, scale: number): void {
  for (const k in v) target[k] = (target[k] ?? 0) + v[k] * scale;
}

export function cosine(a: Vector, b: Vector): number {
  // Iterate the smaller map for the dot product.
  const [small, large] = Object.keys(a).length <= Object.keys(b).length ? [a, b] : [b, a];
  let dot = 0;
  for (const k in small) {
    const bv = large[k];
    if (bv !== undefined) dot += small[k] * bv;
  }
  const denom = norm(a) * norm(b);
  return denom === 0 ? 0 : dot / denom;
}

/** Features available from a lightweight card summary. */
export function featuresFromSummary(s: MediaSummary): Vector {
  const v: Vector = {};
  for (const g of s.genreIds) v[`genre:${g}`] = (v[`genre:${g}`] ?? 0) + 1;
  if (s.originalLanguage) v[`lang:${s.originalLanguage}`] = 0.6;
  const dec = decadeToken(s.year);
  if (dec) v[dec] = 0.5;
  return unit(v);
}

/** Richer features from a full detail payload (keywords + people). */
export function featuresFromDetail(d: MediaDetail): Vector {
  const v: Vector = {};
  for (const g of d.genres) v[`genre:${g.id}`] = (v[`genre:${g.id}`] ?? 0) + 1;
  for (const k of d.keywords.slice(0, 14)) v[`kw:${k.id}`] = 0.8;
  for (const p of d.cast.slice(0, 8)) v[`person:${p.id}`] = 0.7;
  for (const p of d.crew.slice(0, 5)) v[`person:${p.id}`] = 0.8;
  if (d.originalLanguage) v[`lang:${d.originalLanguage}`] = 0.6;
  const dec = decadeToken(d.year);
  if (dec) v[dec] = 0.5;
  const rt = runtimeBucket(d.runtime);
  if (rt) v[rt] = 0.3;
  return unit(v);
}

/** A neutral popularity/quality prior in [0,1] used to break ties. */
export function qualityPrior(s: MediaSummary): number {
  const votes = Math.min(1, Math.log10((s.popularity || 0) + 1) / 3);
  const rating = Math.min(1, (s.voteAverage || 0) / 10);
  return 0.5 * votes + 0.5 * rating;
}
