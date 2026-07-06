"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import { availabilityKey } from "@/lib/availability";
import type { Availability, MediaType } from "@/lib/types";

const FLUSH_MS = 200;
const CHUNK = 50;

type Ref = { id: number; mediaType: MediaType };

/**
 * External store for Seerr availability with per-key subscriptions: a badge only
 * re-renders when ITS title's availability arrives, not on every batch flush.
 * Registrations are debounced and batch-fetched after paint.
 */
class AvailabilityStore {
  private data = new Map<string, Availability>();
  private listeners = new Map<string, Set<() => void>>();
  private known = new Set<string>();
  private queue = new Map<string, Ref>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  get = (key: string): Availability | undefined => this.data.get(key);

  subscribe = (key: string, cb: () => void): (() => void) => {
    let subs = this.listeners.get(key);
    if (!subs) this.listeners.set(key, (subs = new Set()));
    subs.add(cb);
    return () => {
      const s = this.listeners.get(key);
      if (s?.delete(cb) && s.size === 0) this.listeners.delete(key);
    };
  };

  private write(key: string, value: Availability): void {
    this.data.set(key, value);
    this.listeners.get(key)?.forEach((cb) => cb());
  }

  set = (mediaType: MediaType, id: number, value: Availability): void => {
    const key = availabilityKey(mediaType, id);
    this.known.add(key);
    this.write(key, value);
  };

  register = (items: Ref[]): void => {
    let added = false;
    for (const it of items) {
      const key = availabilityKey(it.mediaType, it.id);
      if (this.known.has(key)) continue;
      this.known.add(key);
      this.queue.set(key, it);
      added = true;
    }
    // Fire ~FLUSH_MS after the first pending item (not reset per card) so badges
    // keep hydrating during a continuous scroll.
    if (added && this.timer === null) this.timer = setTimeout(this.flush, FLUSH_MS);
  };

  private flush = async (): Promise<void> => {
    this.timer = null;
    const items = [...this.queue.values()];
    this.queue.clear();
    for (let i = 0; i < items.length; i += CHUNK) {
      try {
        const { availability } = await api.getAvailability(items.slice(i, i + CHUNK));
        for (const key of Object.keys(availability)) this.write(key, availability[key]);
      } catch {
        /* leave unknown */
      }
    }
  };

  dispose(): void {
    if (this.timer !== null) clearTimeout(this.timer);
  }
}

const AvailabilityContext = createContext<AvailabilityStore | null>(null);

export function AvailabilityProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<AvailabilityStore | null>(null);
  ref.current ??= new AvailabilityStore();
  useEffect(() => {
    const store = ref.current;
    return () => store?.dispose();
  }, []);
  return <AvailabilityContext.Provider value={ref.current}>{children}</AvailabilityContext.Provider>;
}

export function useAvailabilityStore(): AvailabilityStore {
  const store = useContext(AvailabilityContext);
  if (!store) throw new Error("useAvailabilityStore must be used within AvailabilityProvider");
  return store;
}

/** Register a title and subscribe to only its availability. */
export function useAvailability(mediaType: MediaType, id: number): Availability | undefined {
  const store = useAvailabilityStore();
  const key = availabilityKey(mediaType, id);
  useEffect(() => {
    store.register([{ id, mediaType }]);
  }, [store, id, mediaType]);
  const subscribe = useCallback((cb: () => void) => store.subscribe(key, cb), [store, key]);
  const snapshot = useCallback(() => store.get(key), [store, key]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
