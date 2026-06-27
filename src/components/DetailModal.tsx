"use client";

import { useQuery } from "@tanstack/react-query";
import { animate, AnimatePresence, motion, useMotionValue } from "framer-motion";
import { Check, HelpCircle, Play, Plus, Star, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useAvailabilityStore } from "@/components/providers/availability";
import { useDetail } from "@/components/providers/detail";
import { TrailerPlayer } from "@/components/TrailerPlayer";
import { Badge } from "@/components/ui/badge";
import { BlurImage } from "@/components/ui/BlurImage";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequestAction } from "@/components/useRequestAction";
import { api, sendSignalBeacon } from "@/lib/api";
import { badgeForAvailability } from "@/lib/availability";
import { tmdbImage } from "@/lib/image";
import { MEDIA_STATUS, type Availability, type MediaType, type ProviderInfo } from "@/lib/types";
import { formatRuntime, ratingPercent } from "@/lib/utils";

export function DetailModal({
  target,
  onClose,
}: {
  target: { type: MediaType; id: number } | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>{target && <ModalShell target={target} onClose={onClose} />}</AnimatePresence>
  );
}

function ModalShell({
  target,
  onClose,
}: {
  target: { type: MediaType; id: number };
  onClose: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const y = useMotionValue(40);
  const drag = useRef<{ startY: number; atTop: boolean } | null>(null);

  // Slide-up entry.
  useEffect(() => {
    const controls = animate(y, 0, { type: "tween", duration: 0.22, ease: "easeOut" });
    return () => controls.stop();
  }, [y]);

  // Esc + a robust background scroll lock. position:fixed (not overflow:hidden)
  // is the only thing that reliably stops iOS Safari from scrolling the page
  // behind the modal; we restore the scroll offset on close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const scrollY = window.scrollY;
    const body = document.body;
    const prev = body.style.cssText;
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      body.style.cssText = prev;
      window.scrollTo(0, scrollY);
    };
  }, [onClose]);

  // Swipe down to dismiss - but only when the content is scrolled to the top,
  // so it never fights normal scrolling.
  const onTouchStart = (e: React.TouchEvent) => {
    drag.current = { startY: e.touches[0].clientY, atTop: (scroller.current?.scrollTop ?? 0) <= 0 };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const d = drag.current;
    if (!d) return;
    const delta = e.touches[0].clientY - d.startY;
    if (d.atTop && delta > 0) {
      y.set(delta * 0.7);
    } else if (y.get() !== 0) {
      y.set(0);
      drag.current = null;
    }
  };
  const onTouchEnd = () => {
    if (y.get() > 110) onClose();
    else animate(y, 0, { type: "tween", duration: 0.18 });
    drag.current = null;
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/80 backdrop-blur-sm md:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        ref={scroller}
        style={{ y }}
        exit={{ opacity: 0 }}
        className="relative max-h-[100dvh] w-full max-w-4xl overflow-y-auto overscroll-contain rounded-none bg-card shadow-2xl md:max-h-[92vh] md:rounded-xl"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Mobile grab handle - signals "pull down to close". */}
        <div className="sticky top-0 z-30 -mb-5 flex justify-center pt-2.5 md:hidden">
          <span className="h-1 w-10 rounded-full bg-white/40" />
        </div>
        <DetailContent key={`${target.type}:${target.id}`} type={target.type} id={target.id} onClose={onClose} />
      </motion.div>
    </motion.div>
  );
}

function DetailContent({
  type,
  id,
  onClose,
}: {
  type: MediaType;
  id: number;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["title", type, id],
    queryFn: () => api.getTitle(type, id),
    staleTime: 5 * 60_000,
  });
  const { set: setAvailability } = useAvailabilityStore();
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (data) setAvailability(type, id, data.availability);
  }, [data, setAvailability, type, id]);

  if (isLoading) {
    return (
      <div>
        <Skeleton className="aspect-video w-full" />
        <div className="space-y-3 p-6">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="p-10 text-center">
        <p className="text-muted-foreground">Couldn’t load this title.</p>
        <Button className="mt-4" variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  const { detail, availability } = data;
  const backdrop = tmdbImage(detail.backdropPath, "backdrop", "w1280");

  return (
    <div>
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute right-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/90"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="relative aspect-video w-full bg-black">
        {playing && detail.trailer ? (
          <TrailerPlayer youtubeKey={detail.trailer.key} muted={false} controls autoplay title={detail.title} />
        ) : (
          <>
            {backdrop && (
              <BlurImage src={backdrop} alt="" fill priority sizes="100vw" className="object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
            <div className="absolute bottom-0 left-0 p-6">
              {detail.logoPath ? (
                <div className="relative mb-4 h-14 w-[min(60vw,300px)] md:h-20">
                  <Image src={tmdbImage(detail.logoPath, "logo", "w500")!} alt={detail.title} fill sizes="(max-width: 768px) 60vw, 300px" className="object-contain object-left" unoptimized />
                </div>
              ) : (
                <h2 className="text-2xl font-black md:text-4xl">{detail.title}</h2>
              )}
              <div className="flex flex-wrap items-center gap-3">
                {detail.trailer && (
                  <Button className="bg-white text-black hover:bg-white/90" onClick={() => setPlaying(true)}>
                    <Play className="h-4 w-4 fill-black" /> Play Trailer
                  </Button>
                )}
                <RequestAction detail={{ id, type, title: detail.title }} availability={availability} />
                <Button
                  variant="secondary"
                  onClick={() => {
                    sendSignalBeacon({ tmdbId: id, mediaType: type, type: "watchlist_add" });
                  }}
                >
                  <Plus className="h-4 w-4" /> My List
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid gap-6 p-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            {detail.voteAverage > 0 && (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                <Star className="h-4 w-4 fill-emerald-400" /> {ratingPercent(detail.voteAverage)}%
              </span>
            )}
            {detail.year && <span>{detail.year}</span>}
            {detail.certification && (
              <span className="rounded border border-border px-1.5 text-xs">{detail.certification}</span>
            )}
            {formatRuntime(detail.runtime) && <span>{formatRuntime(detail.runtime)}</span>}
            {detail.numberOfSeasons && (
              <span>
                {detail.numberOfSeasons} season{detail.numberOfSeasons > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {detail.tagline && <p className="mb-2 italic text-muted-foreground">{detail.tagline}</p>}
          <p className="text-sm leading-relaxed text-zinc-200">{detail.overview}</p>

          <WhyButton type={type} id={id} />

          {detail.cast.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">Cast</h3>
              <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
                {detail.cast.slice(0, 12).map((p) => (
                  <div key={p.id} className="w-20 shrink-0 text-center">
                    <div className="relative mx-auto mb-1 h-20 w-20 overflow-hidden rounded-full bg-muted">
                      {tmdbImage(p.profilePath, "profile", "w185") ? (
                        <BlurImage src={tmdbImage(p.profilePath, "profile", "w185")!} alt={p.name} fill sizes="80px" className="object-cover" />
                      ) : (
                        <Avatar name={p.name} />
                      )}
                    </div>
                    <p className="line-clamp-1 text-xs font-medium">{p.name}</p>
                    <p className="line-clamp-1 text-[11px] text-muted-foreground">{p.role}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {type === "tv" && detail.seasons.length > 0 && (
            <Seasons seasons={detail.seasons} availability={availability} />
          )}
        </div>

        <aside className="space-y-5">
          <WhereToWatch watch={detail.watch} />
          {detail.genres.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">Genres</h3>
              <div className="flex flex-wrap gap-1.5">
                {detail.genres.map((g) => (
                  <Badge key={g.id} className="bg-muted text-foreground">
                    {g.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      <MoreLikeThis detail={detail} />
    </div>
  );
}

function RequestAction({
  detail,
  availability,
}: {
  detail: { id: number; type: MediaType; title: string };
  availability: Availability;
}) {
  const request = useRequestAction();
  const spec = badgeForAvailability(availability);
  if (availability.known && !spec.requestable) {
    return (
      <Button variant="outline" disabled className="opacity-90">
        <Check className="h-4 w-4" /> {spec.label}
      </Button>
    );
  }
  return (
    <Button onClick={() => request({ tmdbId: detail.id, mediaType: detail.type, title: detail.title })}>
      <Plus className="h-4 w-4" /> Request
    </Button>
  );
}

function WhyButton({ type, id }: { type: MediaType; id: number }) {
  const [open, setOpen] = useState(false);
  const { data, isFetching } = useQuery({
    queryKey: ["explain", type, id],
    queryFn: () => api.explain(type, id),
    enabled: open,
    staleTime: 60_000,
  });
  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        <HelpCircle className="h-3.5 w-3.5" /> Why am I seeing this?
      </button>
      {open && (
        <div className="mt-2 rounded-md border border-border bg-muted/40 p-3 text-xs">
          {isFetching ? (
            "Analyzing your taste…"
          ) : (
            <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
              {(data?.reasons ?? []).map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function WhereToWatch({ watch }: { watch: import("@/lib/types").RegionWatch }) {
  const groups: { label: string; items: ProviderInfo[] }[] = [
    { label: "Stream", items: watch.flatrate },
    { label: "Free", items: watch.free },
    { label: "Ads", items: watch.ads },
    { label: "Rent", items: watch.rent },
    { label: "Buy", items: watch.buy },
  ].filter((g) => g.items.length > 0);

  if (!groups.length) {
    return (
      <div>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">Where to watch</h3>
        <p className="text-xs text-muted-foreground">No providers listed for your region.</p>
      </div>
    );
  }
  return (
    <div>
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">Where to watch</h3>
      <div className="space-y-2">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="mb-1 text-[11px] text-muted-foreground">{g.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {g.items.map((p) => (
                <div
                  key={p.providerId}
                  title={p.name}
                  className="relative h-9 w-9 overflow-hidden rounded-md bg-muted"
                >
                  {tmdbImage(p.logoPath, "logo", "w92") && (
                    <Image src={tmdbImage(p.logoPath, "logo", "w92")!} alt={p.name} fill sizes="36px" className="object-cover" unoptimized />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Seasons({
  seasons,
  availability,
}: {
  seasons: import("@/lib/types").SeasonSummary[];
  availability: Availability;
}) {
  return (
    <div className="mt-6">
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">Seasons</h3>
      <div className="space-y-1.5">
        {seasons.map((s) => {
          const status = availability.seasons?.[s.seasonNumber];
          const inLib = status === MEDIA_STATUS.AVAILABLE;
          return (
            <div
              key={s.seasonNumber}
              className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
            >
              <span>
                {s.name} <span className="text-muted-foreground">· {s.episodeCount} ep</span>
              </span>
              {inLib ? (
                <Badge className="bg-emerald-600 text-white">In library</Badge>
              ) : status && status >= MEDIA_STATUS.PENDING ? (
                <Badge className="bg-amber-500 text-black">Requested</Badge>
              ) : (
                <span className="text-xs text-muted-foreground">Not in library</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MoreLikeThis({ detail }: { detail: import("@/lib/types").MediaDetail }) {
  const { open } = useDetail();
  const seen = new Set<string>();
  const items = [...detail.recommendations, ...detail.similar].filter((i) => {
    const k = `${i.mediaType}:${i.id}`;
    if (seen.has(k) || i.id === detail.id) return false;
    seen.add(k);
    return true;
  });
  if (items.length < 4) return null;
  return (
    <div className="border-t border-border p-6">
      <h3 className="mb-3 text-lg font-bold">More Like This</h3>
      <div className="no-scrollbar grid grid-flow-col grid-rows-1 items-start gap-3 overflow-x-auto pb-2" style={{ gridAutoColumns: "9rem" }}>
        {items.slice(0, 18).map((i) => {
          const poster = tmdbImage(i.posterPath, "poster", "w342");
          return (
            <button
              key={`${i.mediaType}:${i.id}`}
              onClick={() => open(i.mediaType, i.id)}
              className="group/mlt flex w-36 flex-col overflow-hidden rounded-md bg-muted text-left outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <div className="relative aspect-[2/3] w-full">
                {poster ? (
                  <BlurImage src={poster} alt={i.title} fill sizes="144px" className="object-cover transition duration-200 group-hover/mlt:scale-105" />
                ) : (
                  <div className="flex h-full items-center justify-center p-2 text-center text-xs text-muted-foreground">
                    {i.title}
                  </div>
                )}
              </div>
              <p className="w-full truncate px-2 py-1.5 text-xs">{i.title}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Initials placeholder for cast members without a profile photo. */
function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-800 text-sm font-semibold text-zinc-300">
      {initials || "?"}
    </div>
  );
}
