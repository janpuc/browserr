"use client";

import { createContext, useCallback, useContext, useState } from "react";
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

  return (
    <DetailContext.Provider value={{ open, close }}>
      {children}
      <DetailModal target={target} onClose={close} />
    </DetailContext.Provider>
  );
}
