"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { availabilityKey } from "@/lib/availability";
import type { Availability, MediaType } from "@/lib/types";

interface AvailabilityContextValue {
  get: (mediaType: MediaType, id: number) => Availability | undefined;
  register: (items: { id: number; mediaType: MediaType }[]) => void;
  set: (mediaType: MediaType, id: number, value: Availability) => void;
}

const AvailabilityContext = createContext<AvailabilityContextValue | null>(null);

/**
 * Collects card (type,id) registrations and batch-fetches Seerr availability
 * after paint, so badges hydrate progressively without blocking initial render.
 */
export function AvailabilityProvider({ children }: { children: React.ReactNode }) {
  const [map, setMap] = useState<Record<string, Availability>>({});
  const known = useRef<Set<string>>(new Set());
  const queue = useRef<Map<string, { id: number; mediaType: MediaType }>>(new Map());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    const items = [...queue.current.values()];
    queue.current.clear();
    if (!items.length) return;
    for (let i = 0; i < items.length; i += 50) {
      const chunk = items.slice(i, i + 50);
      try {
        const { availability } = await api.getAvailability(chunk);
        setMap((m) => ({ ...m, ...availability }));
      } catch {
        /* leave as unknown; badges show "Unknown" */
      }
    }
  }, []);

  const register = useCallback(
    (items: { id: number; mediaType: MediaType }[]) => {
      let added = false;
      for (const it of items) {
        const key = availabilityKey(it.mediaType, it.id);
        if (known.current.has(key)) continue;
        known.current.add(key);
        queue.current.set(key, it);
        added = true;
      }
      if (added) {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(flush, 200);
      }
    },
    [flush],
  );

  const set = useCallback((mediaType: MediaType, id: number, value: Availability) => {
    const key = availabilityKey(mediaType, id);
    known.current.add(key);
    setMap((m) => ({ ...m, [key]: value }));
  }, []);

  const get = useCallback(
    (mediaType: MediaType, id: number) => map[availabilityKey(mediaType, id)],
    [map],
  );

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  // `register`/`set` are stable; `get` changes with `map` so read-consumers
  // re-render when availability arrives. Write-only consumers must depend on
  // `set` alone (not this object) to avoid an update loop.
  const value = useMemo<AvailabilityContextValue>(() => ({ get, register, set }), [get, register, set]);

  return <AvailabilityContext.Provider value={value}>{children}</AvailabilityContext.Provider>;
}

export function useAvailabilityStore(): AvailabilityContextValue {
  const ctx = useContext(AvailabilityContext);
  if (!ctx) throw new Error("useAvailabilityStore must be used within AvailabilityProvider");
  return ctx;
}

/** Convenience hook: register a single title and read its availability. */
export function useAvailability(mediaType: MediaType, id: number): Availability | undefined {
  const { get, register } = useAvailabilityStore();
  useEffect(() => {
    register([{ id, mediaType }]);
  }, [id, mediaType, register]);
  return get(mediaType, id);
}
