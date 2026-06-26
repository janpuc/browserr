/** Interaction signal vocabulary shared by client (capture) and server (weights). */

export const SIGNAL_TYPES = [
  "request",
  "watchlist_add",
  "watchlist_remove",
  "watched",
  "trailer_50",
  "detail_open",
  "hover_long",
  "click",
  "not_interested",
  "hide",
  "dismiss",
] as const;

export type SignalType = (typeof SIGNAL_TYPES)[number];

/** Signed weights: strong/weak positives and negatives (§8). */
export const SIGNAL_WEIGHTS: Record<SignalType, number> = {
  request: 5,
  watchlist_add: 4,
  watchlist_remove: -2,
  watched: 5,
  trailer_50: 3,
  detail_open: 1.5,
  hover_long: 0.5,
  click: 1,
  not_interested: -4,
  hide: -4,
  dismiss: -2,
};

export function isSignalType(v: string): v is SignalType {
  return (SIGNAL_TYPES as readonly string[]).includes(v);
}

/** Signals that should hide a title from future rails. */
export const NEGATIVE_HIDE: ReadonlySet<SignalType> = new Set(["not_interested", "hide"]);
