"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { DetailModal } from "@/components/DetailModal";
import type { MediaType } from "@/lib/types";

interface DetailTarget {
  type: MediaType;
  id: number;
}

const DetailContext = createContext<{
  open: (type: MediaType, id: number) => void;
  close: () => void;
}>({ open: () => {}, close: () => {} });

export function useDetail() {
  return useContext(DetailContext);
}

export function DetailProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<DetailTarget | null>(null);
  const open = useCallback((type: MediaType, id: number) => setTarget({ type, id }), []);
  const close = useCallback(() => setTarget(null), []);
  // Stable value so consumers (every MediaCard) don't re-render when the modal
  // target changes.
  const value = useMemo(() => ({ open, close }), [open, close]);

  return (
    <DetailContext.Provider value={value}>
      {children}
      <DetailModal target={target} onClose={close} />
    </DetailContext.Provider>
  );
}
