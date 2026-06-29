"use client";

import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useState } from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "success" | "error";
interface Toast {
  id: number;
  title: string;
  description?: string;
  variant: Variant;
}

const ToastCtx = createContext<{ toast: (t: Omit<Toast, "id" | "variant"> & { variant?: Variant }) => void }>({
  toast: () => {},
});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((t: Omit<Toast, "id" | "variant"> & { variant?: Variant }) => {
    const id = Date.now() + Math.random();
    setToasts((s) => [...s, { id, variant: "default", ...t }]);
    setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), 4200);
  }, []);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-80 flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20 }}
              className={cn(
                "pointer-events-auto rounded-lg border border-border bg-popover p-3 shadow-xl",
                t.variant === "success" && "border-emerald-600/40",
                t.variant === "error" && "border-red-600/40",
              )}
            >
              <p className="text-sm font-semibold">{t.title}</p>
              {t.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
