"use client";

import { ArrowDown, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const THRESHOLD = 70; // px of (damped) pull needed to trigger
const MIN_SPIN = 650; // keep the spinner up at least this long, so it's visible

/**
 * Pull down (touch) or scroll up past the very top (desktop wheel) to refresh.
 * Renders only a top indicator and listens on the window. Skips while a modal
 * has locked the body (position: fixed).
 */
export function PullToRefresh({ onRefresh }: { onRefresh: () => Promise<unknown> }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [active, setActive] = useState(false); // true while following a gesture → no CSS easing
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const s = { pull: 0, startY: null as number | null, accum: 0, busy: false, pulling: false };
    const atTop = () => window.scrollY <= 0;
    const locked = () => document.body.style.position === "fixed";

    const render = (p: number) => {
      s.pull = p;
      setPull(p);
    };
    const startPull = () => {
      if (!s.pulling) {
        s.pulling = true;
        setActive(true);
      }
    };
    const stopPull = () => {
      if (s.pulling) {
        s.pulling = false;
        setActive(false);
      }
    };
    const reset = () => {
      s.accum = 0;
      stopPull();
      render(0);
    };

    let retract: ReturnType<typeof setTimeout> | null = null;

    const trigger = async () => {
      if (s.busy) return;
      s.busy = true;
      s.accum = 0;
      stopPull();
      setRefreshing(true);
      render(THRESHOLD);
      const started = Date.now();
      try {
        await onRefreshRef.current();
      } catch {
        /* ignore — still give feedback */
      }
      const wait = MIN_SPIN - (Date.now() - started);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      s.busy = false;
      setRefreshing(false);
      render(0);
    };

    // ---- touch ----
    const onTouchStart = (e: TouchEvent) => {
      s.startY = atTop() && !s.busy && !locked() ? e.touches[0].clientY : null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (s.startY == null || s.busy) return;
      const delta = e.touches[0].clientY - s.startY;
      if (delta > 0 && atTop()) {
        startPull();
        render(Math.min(delta ** 0.85, THRESHOLD * 1.6)); // resistance curve
      } else if (s.pull) {
        reset();
      }
    };
    const onTouchEnd = () => {
      if (s.startY != null && s.pull >= THRESHOLD) void trigger();
      else reset();
      s.startY = null;
    };

    // ---- desktop wheel ----
    const onWheel = (e: WheelEvent) => {
      if (s.busy || locked()) return;
      if (!atTop()) {
        if (s.accum) reset();
        return;
      }
      if (e.deltaY < 0) {
        // scrolling up while already pinned at the top
        s.accum += -e.deltaY;
        startPull();
        render(Math.min(s.accum * 0.55, THRESHOLD * 1.6));
        if (s.pull >= THRESHOLD) {
          void trigger();
          return;
        }
        // if the user stops short, retract instead of hanging
        if (retract) clearTimeout(retract);
        retract = setTimeout(() => {
          if (!s.busy) reset();
        }, 200);
      } else if (e.deltaY > 0 && s.accum) {
        reset();
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("wheel", onWheel);
      if (retract) clearTimeout(retract);
    };
  }, []);

  const progress = Math.min(pull / THRESHOLD, 1);
  const visible = pull > 2 || refreshing;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center"
      style={{
        transform: `translateY(${refreshing ? 16 : pull - 44}px)`,
        opacity: visible ? 1 : 0,
        transition: active ? "none" : "transform 0.3s ease, opacity 0.3s ease",
      }}
    >
      <div className="mt-2 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card shadow-lg">
        {refreshing ? (
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
        ) : (
          <ArrowDown
            className="h-4 w-4 transition-transform"
            style={{
              transform: `rotate(${progress * 180}deg)`,
              color: progress >= 1 ? "hsl(var(--accent))" : "hsl(var(--muted-foreground))",
            }}
          />
        )}
      </div>
    </div>
  );
}
