"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Info, Play, Plus, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useAvailability } from "@/components/providers/availability";
import { useConfig } from "@/components/providers/config";
import { useDetail } from "@/components/providers/detail";
import { TrailerPlayer } from "@/components/TrailerPlayer";
import { BlurImage } from "@/components/ui/BlurImage";
import { Button } from "@/components/ui/button";
import { useRequestAction } from "@/components/useRequestAction";
import { badgeForAvailability } from "@/lib/availability";
import { sendSignalBeacon } from "@/lib/api";
import { tmdbImage } from "@/lib/image";
import { useIsTouch } from "@/lib/platform";
import type { HeroSlide } from "@/lib/types";
import { cn, formatRuntime } from "@/lib/utils";

/** Hero CTA buttons: compact on mobile, full-size (lg) from md up so they fit. */
const BTN_LG = "md:h-12 md:px-6 md:text-base";

export function Hero({ slides, onReady }: { slides: HeroSlide[]; onReady?: () => void }) {
  const { config } = useConfig();
  const { open } = useDetail();
  const reduce = useReducedMotion();
  const request = useRequestAction();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const touch = useIsTouch();
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const go = (dir: 1 | -1) => {
    setIndex((i) => (i + dir + slides.length) % slides.length);
    setPlaying(false);
  };
  const onTouchStart = (e: React.TouchEvent) => {
    swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start || slides.length <= 1) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    // Horizontal-dominant swipe past a threshold flips the slide.
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx < 0 ? 1 : -1);
  };

  const rotateSeconds = config.features.heroRotateSeconds || 12;

  useEffect(() => {
    if (playing || slides.length <= 1 || rotateSeconds <= 0) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), rotateSeconds * 1000);
    return () => clearInterval(t);
  }, [playing, slides.length, rotateSeconds]);

  // If the first slide has no backdrop image, there's nothing to wait for -
  // tell the boot splash we're ready immediately.
  useEffect(() => {
    const first = slides[0]?.item;
    if (first && !tmdbImage(first.backdropPath, "backdrop", "w1280")) onReady?.();
  }, [slides, onReady]);

  if (!slides.length) return null;
  const slide = slides[index];
  const { item } = slide;

  return (
    <section
      className="group/hero relative h-[58vh] min-h-[420px] w-full overflow-hidden md:h-[78vh]"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <AnimatePresence mode="popLayout">
        <motion.div
          key={item.id}
          initial={{ opacity: reduce ? 1 : 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.8 }}
          className="absolute inset-0"
        >
          {playing && slide.trailer ? (
            <div className="absolute inset-0 bg-black">
              <TrailerPlayer youtubeKey={slide.trailer.key} muted={false} controls autoplay title={item.title} />
            </div>
          ) : (
            tmdbImage(item.backdropPath, "backdrop", "w1280") && (
              <BlurImage
                src={tmdbImage(item.backdropPath, "backdrop", "w1280")!}
                alt=""
                fill
                priority
                sizes="100vw"
                className="object-cover object-top"
                onLoad={() => onReady?.()}
                onError={() => onReady?.()}
              />
            )
          )}
        </motion.div>
      </AnimatePresence>

      {/* Cinematic gradients. */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/30 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 px-4 pb-16 md:px-12 md:pb-24">
        <div className="max-w-xl">
          {slide.logoPath ? (
            <div className="relative mb-4 h-16 w-[min(70vw,360px)] md:h-24">
              <Image
                src={tmdbImage(slide.logoPath, "logo", "w500")!}
                alt={item.title}
                fill
                sizes="(max-width: 768px) 70vw, 360px"
                className="object-contain object-left drop-shadow-lg"
                unoptimized
              />
            </div>
          ) : (
            <h1 className="mb-3 text-3xl font-black drop-shadow-lg md:text-5xl">{item.title}</h1>
          )}

          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            {item.voteAverage > 0 && (
              <span className="font-bold text-emerald-400">{Math.round(item.voteAverage * 10)}% match</span>
            )}
            {item.year && <span>{item.year}</span>}
            {slide.certification && (
              <span className="rounded border border-white/40 px-1.5 text-xs">{slide.certification}</span>
            )}
            {formatRuntime(slide.runtime) && <span>{formatRuntime(slide.runtime)}</span>}
            {slide.genres.slice(0, 3).map((g) => (
              <span key={g} className="text-muted-foreground">
                {g}
              </span>
            ))}
          </div>

          {!playing && (
            <p className="mb-5 line-clamp-3 max-w-lg text-sm text-zinc-200 md:text-base">{item.overview}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            {slide.trailer &&
              (playing ? (
                <Button variant="secondary" size="md" className={BTN_LG} onClick={() => setPlaying(false)}>
                  <X className="h-4 w-4 md:h-5 md:w-5" /> Stop
                </Button>
              ) : (
                <Button
                  size="md"
                  className={cn("bg-white text-black hover:bg-white/90", BTN_LG)}
                  onClick={() => {
                    setPlaying(true);
                    sendSignalBeacon({ tmdbId: item.id, mediaType: item.mediaType, type: "trailer_50" });
                  }}
                >
                  <Play className="h-4 w-4 fill-black md:h-5 md:w-5" /> Play Trailer
                </Button>
              ))}
            <RequestButton
              tmdbId={item.id}
              mediaType={item.mediaType}
              title={item.title}
              onRequest={request}
            />
            <Button
              variant="secondary"
              size="md"
              className={BTN_LG}
              onClick={() => {
                sendSignalBeacon({ tmdbId: item.id, mediaType: item.mediaType, type: "detail_open" });
                open(item.mediaType, item.id);
              }}
            >
              <Info className="h-4 w-4 md:h-5 md:w-5" /> More Info
            </Button>
          </div>
        </div>
      </div>

      {/* Prev/next arrows: hidden until hover on desktop, always tappable on touch. */}
      {slides.length > 1 && (
        <>
          <button
            aria-label="Previous title"
            onClick={() => go(-1)}
            className={cn(
              "absolute left-1 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/70 md:left-3",
              touch ? "opacity-80" : "opacity-0 group-hover/hero:opacity-100",
            )}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            aria-label="Next title"
            onClick={() => go(1)}
            className={cn(
              "absolute right-1 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/70 md:right-3",
              touch ? "opacity-80" : "opacity-0 group-hover/hero:opacity-100",
            )}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* Slide indicators. */}
      {slides.length > 1 && (
        <div className="absolute bottom-20 right-6 hidden gap-1.5 md:flex">
          {slides.map((s, i) => (
            <button
              key={s.item.id}
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => {
                setIndex(i);
                setPlaying(false);
              }}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-6 bg-white" : "w-1.5 bg-white/40",
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function RequestButton({
  tmdbId,
  mediaType,
  title,
  onRequest,
}: {
  tmdbId: number;
  mediaType: HeroSlide["item"]["mediaType"];
  title: string;
  onRequest: (i: { tmdbId: number; mediaType: HeroSlide["item"]["mediaType"]; title: string }) => void;
}) {
  const availability = useAvailability(mediaType, tmdbId);
  const spec = badgeForAvailability(availability);

  if (availability && !spec.requestable) {
    return (
      <Button variant="outline" size="md" disabled className={cn("opacity-90", BTN_LG)}>
        <Check className="h-4 w-4 md:h-5 md:w-5" /> {spec.label}
      </Button>
    );
  }
  return (
    <Button size="md" className={BTN_LG} onClick={() => onRequest({ tmdbId, mediaType, title })}>
      <Plus className="h-4 w-4 md:h-5 md:w-5" /> Request
    </Button>
  );
}
