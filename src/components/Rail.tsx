"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { MediaCard } from "@/components/MediaCard";
import { Skeleton } from "@/components/ui/skeleton";
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

export function Rail({ rail }: { rail: RailModel }) {
  const { ref, inView } = useInView<HTMLElement>();
  const scroller = useRef<HTMLDivElement>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  // A native overflow-x scroller handles trackpad swipe, touch, momentum and
  // keyboard focus-scroll for free; we only track edges to show/hide arrows.
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
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  const items = rail.items.filter((i) => !hiddenIds.has(i.id));
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
            "absolute left-0 top-0 z-20 hidden h-full w-12 items-center justify-center bg-gradient-to-r from-background/90 to-transparent opacity-0 transition group-hover/rail:opacity-100 md:flex",
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
            "absolute right-0 top-0 z-20 hidden h-full w-12 items-center justify-center bg-gradient-to-l from-background/90 to-transparent opacity-0 transition group-hover/rail:opacity-100 md:flex",
            !canNext && "pointer-events-none !opacity-0",
          )}
        >
          <ChevronRight className="h-8 w-8" />
        </button>

        <div
          ref={scroller}
          onScroll={updateArrows}
          // overflow-y-hidden + touch-pan-x lock this to horizontal only: setting
          // just overflow-x would make the browser compute overflow-y as scrollable.
          // py-4 gives the hover zoom room so it isn't clipped by overflow-y-hidden.
          className="no-scrollbar flex gap-2.5 overflow-x-auto overflow-y-hidden overscroll-x-contain touch-pan-x scroll-smooth px-4 py-4 md:px-12"
        >
          {!inView
            ? Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className={cn("aspect-[2/3]", CARD_WIDTH)} />
              ))
            : items.map((item, idx) => (
                <div key={`${item.mediaType}:${item.id}`} className={CARD_WIDTH}>
                  <MediaCard
                    item={item}
                    rank={isTop10 ? idx + 1 : undefined}
                    onHide={(id) => setHiddenIds((s) => new Set(s).add(id))}
                  />
                </div>
              ))}
        </div>
      </div>
    </section>
  );
}
