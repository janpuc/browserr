import { MEDIA_STATUS, type Availability } from "./types";

export interface BadgeSpec {
  label: string;
  /** Tailwind classes for the badge background/text. */
  className: string;
  /** Whether this state means "offer a Request action". */
  requestable: boolean;
}

/**
 * Map a Seerr media status → a badge. Status values: 5 available, 4 partial,
 * 3 processing, 2 pending/requested, else Request CTA. Unknown (Seerr down) is
 * rendered distinctly so the catalog still browses.
 */
export function badgeForAvailability(a: Availability | undefined): BadgeSpec {
  if (!a || !a.known) {
    return { label: "Unknown", className: "bg-zinc-700/80 text-zinc-200", requestable: true };
  }
  switch (a.status) {
    case MEDIA_STATUS.AVAILABLE:
      return { label: "In your library", className: "bg-emerald-600 text-white", requestable: false };
    case MEDIA_STATUS.PARTIALLY_AVAILABLE:
      return { label: "Partially available", className: "bg-teal-600 text-white", requestable: false };
    case MEDIA_STATUS.PROCESSING:
      return { label: "Processing", className: "bg-sky-600 text-white", requestable: false };
    case MEDIA_STATUS.PENDING:
      return { label: "Requested", className: "bg-amber-500 text-black", requestable: false };
    default:
      return { label: "Request", className: "bg-accent text-accent-foreground", requestable: true };
  }
}

export function availabilityKey(mediaType: string, id: number): string {
  return `${mediaType}:${id}`;
}
