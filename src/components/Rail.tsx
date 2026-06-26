"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useConfig } from "@/components/providers/config";
import { MediaCard } from "@/components/MediaCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsTouch } from "@/lib/platform";
import type { Rail as RailModel } from "@/lib/types";
import { cn } from "@/lib/utils";

function useInView<T extends HTMLElement>(rootMargin = "400px") {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          obs.disconnect();
        }
      },
      { rootMargin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [inView, rootMargin]);
  return { ref, inView };
}

const CARD_WIDTH = "w-[40vw] shrink-0 sm:w-[28vw] md:w-[18vw] lg:w-[14vw] xl:w-[12vw]";
// A 16:9 frame at the poster's height is ~2.67× as wide; each neighbour slides
// half that overflow aside so the expansion drops cleanly into the gap.
const SHIFT_PCT = 83.3;
const EXPAND_RATIO = 2.666;
const EDGE_PAD = 16;

/** px nudge so a near-edge expansion stays fully on-screen with a little padding. */
function computeEdgeShift(el: HTMLElement, idx: number): number {
  const card = el.children[idx] as HTMLElement | undefined;
  if (!card) return 0;
  const w = card.offsetWidth;
  const overlayW = w * EXPAND_RATIO;
  // Wider than the viewport (small screens): centre it, nothing to clamp.
  if (overlayW >= el.clientWidth - EDGE_PAD * 2) return 0;
  const center = card.offsetLeft + w / 2 - el.scrollLeft;
  const left = center - overlayW / 2;
  const right = center + overlayW / 2;
  if (left < EDGE_PAD) return Math.round(EDGE_PAD - left);
  if (right > el.clientWidth - EDGE_PAD) return Math.round(el.clientWidth - EDGE_PAD - right);
  return 0;
}

export function Rail({ rail }: { rail: RailModel }) {
  const { ref, inView } = useInView<HTMLElement>();
  const { config } = useConfig();
  const touch = useIsTouch();
  const scroller = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [expandShift, setExpandShift] = useState(0);

  const updateArrows = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    if (!inView) return;
    updateArrows();
    window.addEventListener("resize", updateArrows);
    return () => window.removeEventListener("resize", updateArrows);
  }, [inView, updateArrows]);

  const scrollByPage = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    setExpandedIdx(null);
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  const requestExpand = useCallback((i: number) => {
    const el = scroller.current;
    setExpandShift(el ? computeEdgeShift(el, i) : 0);
    setExpandedIdx(i);
  }, []);
  const requestCollapse = useCallback(
    (i: number) => setExpandedIdx((cur) => (cur === i ? null : cur)),
    [],
  );

  // Touch + opt-in: auto-expand whichever card is centred in the rail.
  const autoExpand = touch && config.features.mobileAutoExpand;
  const items = rail.items;
  useEffect(() => {
    if (!autoExpand || !inView) return;
    const el = scroller.current;
    if (!el) return;
    let settle: ReturnType<typeof setTimeout>;
    const pick = () => {
      const center = el.scrollLeft + el.clientWidth / 2;
      const kids = Array.from(el.children) as HTMLElement[];
      let best: number | null = null;
      let bestDist = Infinity;
      kids.forEach((c, i) => {
        const cc = c.offsetLeft + c.offsetWidth / 2;
        const d = Math.abs(cc - center);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      setExpandShift(best == null ? 0 : computeEdgeShift(el, best));
      setExpandedIdx(best);
    };
    const onScroll = () => {
      clearTimeout(settle);
      settle = setTimeout(pick, 150);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const initial = setTimeout(pick, 250);
    return () => {
      el.removeEventListener("scroll", onScroll);
      clearTimeout(settle);
      clearTimeout(initial);
    };
  }, [autoExpand, inView, items.length]);

  // Reset when the rail's content swaps (e.g. a feed refresh).
  useEffect(() => setExpandedIdx(null), [rail.id]);

  const isTop10 = rail.kind === "top10";
  const reason = rail.context?.reason;

  return (
    <section ref={ref} className="group/rail relative" aria-label={rail.title}>
      <div className="mb-2 flex items-baseline gap-3 px-4 md:px-12">
        <h2 className="min-w-0 truncate text-lg font-bold tracking-tight md:text-xl">{rail.title}</h2>
        {reason && (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {reason}
          </span>
        )}
      </div>

      <div className="relative">
        <button
          aria-label="Scroll left"
          tabIndex={-1}
          onClick={() => scrollByPage(-1)}
          className={cn(
            "absolute left-0 top-0 z-40 hidden h-full w-12 items-center justify-center bg-gradient-to-r from-background/90 to-transparent opacity-0 transition group-hover/rail:opacity-100 md:flex",
            !canPrev && "pointer-events-none !opacity-0",
          )}
        >
          <ChevronLeft className="h-8 w-8" />
        </button>
        <button
          aria-label="Scroll right"
          tabIndex={-1}
          onClick={() => scrollByPage(1)}
          className={cn(
            "absolute right-0 top-0 z-40 hidden h-full w-12 items-center justify-center bg-gradient-to-l from-background/90 to-transparent opacity-0 transition group-hover/rail:opacity-100 md:flex",
            !canNext && "pointer-events-none !opacity-0",
          )}
        >
          <ChevronRight className="h-8 w-8" />
        </button>

        <div
          ref={scroller}
          onScroll={updateArrows}
          // overflow-y-hidden + touch-pan-x lock this to horizontal only; py-4 gives
          // the expansion's shadow a little room above/below the row.
          className="no-scrollbar flex gap-2.5 overflow-x-auto overflow-y-hidden overscroll-x-contain touch-pan-x scroll-smooth px-4 py-4 md:px-12"
        >
          {!inView
            ? Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className={cn("aspect-[2/3]", CARD_WIDTH)} />
              ))
            : items.map((item, idx) => {
                const transform =
                  expandedIdx === null || idx === expandedIdx
                    ? undefined
                    : `translateX(${idx < expandedIdx ? "-" : ""}${SHIFT_PCT}%)`;
                return (
                  <div
                    key={`${item.mediaType}:${item.id}`}
                    className={cn(CARD_WIDTH, "relative transition-transform duration-200 ease-out")}
                    style={{ transform, zIndex: idx === expandedIdx ? 30 : undefined }}
                  >
                    <MediaCard
                      item={item}
                      rank={isTop10 ? idx + 1 : undefined}
                      expanded={idx === expandedIdx}
                      expandShiftPx={idx === expandedIdx ? expandShift : 0}
                      onRequestExpand={() => requestExpand(idx)}
                      onRequestCollapse={() => requestCollapse(idx)}
                    />
                  </div>
                );
              })}
        </div>
      </div>
    </section>
  );
}
