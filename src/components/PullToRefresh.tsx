"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BrandSpinner } from "@/components/ui/BrandSpinner";

const THRESHOLD = 70; // px of (damped) pull needed to trigger
const REVEAL = 88; // px the page sits open while the refresh spins
const MIN_SPIN = 650; // keep the spinner up at least this long, so it's visible
const COOLDOWN = 1500; // lock-out after a refresh before another can be started
const MAX_PULL = THRESHOLD * 1.6;

// useLayoutEffect on the client (so the shell transform commits in the same frame
// as the reveal strip), but fall back to useEffect on the server to avoid warnings.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Pull down (touch) or scroll up past the very top (desktop wheel) to refresh.
 * The whole page (#page-shell) slides down to reveal a dark strip with the
 * branded spinner centered in it. Skips while a modal has locked the body.
 */
export function PullToRefresh({ onRefresh }: { onRefresh: () => Promise<unknown> }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [active, setActive] = useState(false); // true while following a gesture → no easing
  const [mounted, setMounted] = useState(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let alive = true;
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
      render(0);
      setRefreshing(true); // shell settles to REVEAL via the layout effect
      const started = Date.now();
      try {
        await onRefreshRef.current();
      } catch {
        /* ignore - still give feedback */
      }
      const wait = MIN_SPIN - (Date.now() - started);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      if (!alive) return;
      setRefreshing(false);
      // Stay locked a beat longer so the user can't immediately fire another.
      await new Promise((r) => setTimeout(r, COOLDOWN));
      s.busy = false;
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
        render(Math.min(delta ** 0.85, MAX_PULL)); // resistance curve
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
        s.accum += -e.deltaY;
        startPull();
        render(Math.min(s.accum * 0.55, MAX_PULL));
        if (s.pull >= THRESHOLD) {
          void trigger();
          return;
        }
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
      alive = false;
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("wheel", onWheel);
      if (retract) clearTimeout(retract);
    };
  }, []);

  const shellY = refreshing ? REVEAL : pull;

  // Translate the whole page shell down so the reveal strip shows above it.
  useIsoLayoutEffect(() => {
    const shell = document.getElementById("page-shell");
    if (!shell) return;
    shell.style.transition = active ? "none" : "transform 0.3s ease";
    shell.style.transform = shellY ? `translateY(${shellY}px)` : "";
  }, [shellY, active]);

  useEffect(
    () => () => {
      const shell = document.getElementById("page-shell");
      if (shell) {
        shell.style.transform = "";
        shell.style.transition = "";
      }
    },
    [],
  );

  const progress = Math.min(pull / THRESHOLD, 1);

  const indicator = (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[45] flex items-center justify-center overflow-hidden bg-background"
      style={{ height: shellY, transition: active ? "none" : "height 0.3s ease" }}
    >
      <div style={{ opacity: refreshing ? 1 : progress }}>
        <BrandSpinner label={false} />
      </div>
    </div>
  );

  return mounted ? createPortal(indicator, document.body) : null;
}
