"use client";

import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef } from "react";
import { AvailabilityBadge } from "@/components/AvailabilityBadge";
import { useAvailabilityStore } from "@/components/providers/availability";
import { useConfig } from "@/components/providers/config";
import { useDetail } from "@/components/providers/detail";
import { TrailerPlayer } from "@/components/TrailerPlayer";
import { BlurImage } from "@/components/ui/BlurImage";
import { api, sendSignalBeacon } from "@/lib/api";
import { tmdbImage } from "@/lib/image";
import { useIsTouch } from "@/lib/platform";
import type { MediaSummary } from "@/lib/types";

function Poster({ src, alt }: { src: string; alt: string }) {
  return (
    <>
      <BlurImage
        src={src}
        alt=""
        fill
        sizes="(max-width: 640px) 40vw, (max-width: 1024px) 22vw, 15vw"
        className="object-cover"
      />
      <span className="sr-only">{alt}</span>
    </>
  );
}

function NoPoster({ title }: { title: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 p-3 text-center text-xs font-medium text-muted-foreground">
      {title}
    </div>
  );
}

export function MediaCard({
  item,
  rank,
  expanded = false,
  expandShiftPx = 0,
  onRequestExpand,
  onRequestCollapse,
}: {
  item: MediaSummary;
  rank?: number;
  /** Driven by the parent Rail (it owns which card is expanded). */
  expanded?: boolean;
  /** px nudge applied to keep an edge expansion fully on-screen. */
  expandShiftPx?: number;
  onRequestExpand?: () => void;
  onRequestCollapse?: () => void;
}) {
  const { open } = useDetail();
  const { config } = useConfig();
  const { set: setAvailability } = useAvailabilityStore();
  const reduce = useReducedMotion();
  const touch = useIsTouch();

  const dwell = useRef<ReturnType<typeof setTimeout> | null>(null);
  const grace = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverLongFired = useRef(false);
  const trailer50Fired = useRef(false);

  const fire = useCallback(
    (type: Parameters<typeof sendSignalBeacon>[0]["type"]) =>
      sendSignalBeacon({ tmdbId: item.id, mediaType: item.mediaType, type }),
    [item.id, item.mediaType],
  );

  // Detail (for the trailer) is only fetched once the card is expanded.
  const { data } = useQuery({
    queryKey: ["title", item.mediaType, item.id],
    queryFn: () => api.getTitle(item.mediaType, item.id),
    enabled: expanded,
    staleTime: 5 * 60_000,
  });
  useEffect(() => {
    if (data) setAvailability(item.mediaType, item.id, data.availability);
  }, [data, setAvailability, item.mediaType, item.id]);

  const trailerKey = data?.detail.trailer?.key ?? null;
  const wantsTrailer = expanded && config.features.enableTrailerAutoplay && !reduce && !!trailerKey;
  const dwellMs = config.features.hoverExpandMs || 900;

  useEffect(() => {
    if (expanded && !hoverLongFired.current) {
      hoverLongFired.current = true;
      fire("hover_long");
    }
  }, [expanded, fire]);

  // Heuristic "trailer played to ~50%": continuous playback for ~9s.
  useEffect(() => {
    if (!wantsTrailer || trailer50Fired.current) return;
    const t = setTimeout(() => {
      trailer50Fired.current = true;
      fire("trailer_50");
    }, 9000);
    return () => clearTimeout(t);
  }, [wantsTrailer, fire]);

  const clearTimers = useCallback(() => {
    if (dwell.current) clearTimeout(dwell.current);
    if (grace.current) clearTimeout(grace.current);
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  // Desktop: a longer hold expands; a short grace on leave bridges the gap to the
  // overflowing preview so it doesn't flicker. Touch uses the Rail's auto-expand.
  const onEnter = useCallback(() => {
    if (touch) return;
    if (grace.current) clearTimeout(grace.current);
    if (dwell.current) clearTimeout(dwell.current);
    dwell.current = setTimeout(() => onRequestExpand?.(), dwellMs);
  }, [touch, dwellMs, onRequestExpand]);

  const onLeave = useCallback(() => {
    if (touch) return;
    if (dwell.current) clearTimeout(dwell.current);
    grace.current = setTimeout(() => onRequestCollapse?.(), 90);
  }, [touch, onRequestCollapse]);

  const openDetail = useCallback(() => {
    fire("detail_open");
    open(item.mediaType, item.id);
  }, [fire, open, item.mediaType, item.id]);

  const poster = tmdbImage(item.posterPath, "poster", "w342");
  const backdrop = tmdbImage(item.backdropPath, "backdrop", "w780") ?? poster;

  return (
    <div
      className="group relative cursor-pointer outline-none"
      role="button"
      tabIndex={0}
      aria-label={item.title}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      onClick={openDetail}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDetail();
        }
      }}
    >
      <motion.div className="relative aspect-[2/3] overflow-hidden rounded-md bg-muted ring-0 ring-white/20 group-focus-visible:ring-2">
        {poster ? <Poster src={poster} alt={item.title} /> : <NoPoster title={item.title} />}

        {rank !== undefined && (
          <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-lg font-black leading-none tabular-nums text-white shadow">
            {rank}
          </span>
        )}

        <div className="absolute right-1.5 top-1.5">
          <AvailabilityBadge mediaType={item.mediaType} id={item.id} hideWhenRequestable className="text-[10px]" />
        </div>
      </motion.div>

      {/* In-row expansion: a 16:9 frame at the poster's height (so it's exactly the
          trailer's ratio), centred and overflowing into the space the Rail clears
          on either side. Only the trailer + title — details open on click. */}
      {expanded && (
        <motion.div
          className="absolute left-1/2 top-0 z-30 h-full w-[266.6%] overflow-hidden rounded-md bg-black shadow-2xl ring-1 ring-white/10"
          style={{ transform: `translateX(calc(-50% + ${expandShiftPx}px))` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18 }}
        >
          {/* Backdrop is the base layer so there's never a black flash; the
              trailer fades in over it once it's ready. */}
          {backdrop && <BlurImage src={backdrop} alt="" fill sizes="540px" className="object-cover" />}
          {wantsTrailer && trailerKey && (
            <div className="absolute inset-0">
              <TrailerPlayer youtubeKey={trailerKey} loop muted cover title={item.title} />
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-2.5 pt-10">
            <p className="line-clamp-1 text-sm font-bold drop-shadow">{item.title}</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
