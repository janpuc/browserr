"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Info, Play, Plus, ThumbsDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AvailabilityBadge } from "@/components/AvailabilityBadge";
import { useAvailabilityStore } from "@/components/providers/availability";
import { useConfig } from "@/components/providers/config";
import { useDetail } from "@/components/providers/detail";
import { TrailerPlayer } from "@/components/TrailerPlayer";
import { BlurImage } from "@/components/ui/BlurImage";
import { useToast } from "@/components/ui/toast";
import { api, sendSignalBeacon } from "@/lib/api";
import { tmdbImage } from "@/lib/image";
import type { MediaSummary } from "@/lib/types";
import { ratingPercent } from "@/lib/utils";

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
  onHide,
}: {
  item: MediaSummary;
  rank?: number;
  onHide?: (id: number) => void;
}) {
  const { open } = useDetail();
  const { config } = useConfig();
  const { toast } = useToast();
  const { set: setAvailability } = useAvailabilityStore();
  const reduce = useReducedMotion();

  const [hovered, setHovered] = useState(false);
  const [hidden, setHidden] = useState(false);
  const dwell = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trailerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverLongFired = useRef(false);
  const trailer50Fired = useRef(false);

  const fire = useCallback(
    (type: Parameters<typeof sendSignalBeacon>[0]["type"]) =>
      sendSignalBeacon({ tmdbId: item.id, mediaType: item.mediaType, type }),
    [item.id, item.mediaType],
  );

  // Fetch full detail on hover to power the inline trailer + hydrate availability.
  const { data } = useQuery({
    queryKey: ["title", item.mediaType, item.id],
    queryFn: () => api.getTitle(item.mediaType, item.id),
    enabled: hovered,
    staleTime: 5 * 60_000,
  });
  useEffect(() => {
    if (data) setAvailability(item.mediaType, item.id, data.availability);
  }, [data, setAvailability, item.mediaType, item.id]);

  const trailerKey = data?.detail.trailer?.key ?? null;
  const wantsTrailer = hovered && config.features.enableTrailerAutoplay && !reduce && !!trailerKey;

  const startHover = useCallback(() => {
    if (dwell.current) clearTimeout(dwell.current);
    dwell.current = setTimeout(() => {
      setHovered(true);
      if (!hoverLongFired.current) {
        hoverLongFired.current = true;
        fire("hover_long");
      }
    }, 480);
  }, [fire]);

  const endHover = useCallback(() => {
    if (dwell.current) clearTimeout(dwell.current);
    if (trailerTimer.current) clearTimeout(trailerTimer.current);
    setHovered(false);
  }, []);

  // Heuristic "trailer played to ~50%": continuous playback for ~9s.
  useEffect(() => {
    if (wantsTrailer && !trailer50Fired.current) {
      trailerTimer.current = setTimeout(() => {
        trailer50Fired.current = true;
        fire("trailer_50");
      }, 9000);
    }
    return () => {
      if (trailerTimer.current) clearTimeout(trailerTimer.current);
    };
  }, [wantsTrailer, fire]);

  const openDetail = useCallback(() => {
    fire("detail_open");
    open(item.mediaType, item.id);
  }, [fire, open, item.mediaType, item.id]);

  if (hidden) return null;

  const poster = tmdbImage(item.posterPath, "poster", "w342");

  return (
    <div
      className="group relative cursor-pointer outline-none"
      role="button"
      tabIndex={0}
      aria-label={item.title}
      onMouseEnter={startHover}
      onMouseLeave={endHover}
      onFocus={startHover}
      onBlur={endHover}
      onClick={openDetail}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDetail();
        }
      }}
    >
      <motion.div
        className="relative aspect-[2/3] overflow-hidden rounded-md bg-muted ring-0 ring-white/20 group-focus-visible:ring-2"
        whileHover={reduce ? undefined : { scale: 1.05 }}
        transition={{ type: "tween", duration: 0.18 }}
      >
        {poster ? <Poster src={poster} alt={item.title} /> : <NoPoster title={item.title} />}

        {wantsTrailer && trailerKey && (
          <div className="pointer-events-none absolute inset-0">
            <TrailerPlayer youtubeKey={trailerKey} loop muted controls={false} title={item.title} />
          </div>
        )}

        {rank !== undefined && (
          <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-lg font-black leading-none tabular-nums text-white shadow">
            {rank}
          </span>
        )}

        <div className="absolute right-1.5 top-1.5">
          <AvailabilityBadge mediaType={item.mediaType} id={item.id} hideWhenRequestable className="text-[10px]" />
        </div>

        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-2.5 pt-8"
            >
              <p className="line-clamp-1 text-sm font-semibold">{item.title}</p>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                {item.year && <span>{item.year}</span>}
                {item.voteAverage > 0 && (
                  <span className="font-semibold text-emerald-400">{ratingPercent(item.voteAverage)}%</span>
                )}
                <span className="uppercase">{item.mediaType}</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <button
                  className="flex h-7 items-center gap-1 rounded-full bg-white px-2.5 text-xs font-bold text-black transition hover:bg-white/90"
                  onClick={openDetail}
                  aria-label={`Play ${item.title}`}
                >
                  <Play className="h-3.5 w-3.5 fill-black" /> Play
                </button>
                <IconAction
                  label="Add to My List"
                  onClick={() => {
                    fire("watchlist_add");
                    toast({ title: "Added to My List", description: item.title, variant: "success" });
                  }}
                >
                  <Plus className="h-4 w-4" />
                </IconAction>
                <IconAction label="More info" onClick={openDetail}>
                  <Info className="h-4 w-4" />
                </IconAction>
                <IconAction
                  label="Not interested"
                  onClick={() => {
                    fire("not_interested");
                    setHidden(true);
                    onHide?.(item.id);
                  }}
                >
                  <ThumbsDown className="h-4 w-4" />
                </IconAction>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function IconAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-full border border-white/40 bg-black/40 text-white transition hover:border-white hover:bg-black/70"
    >
      {children}
    </button>
  );
}
