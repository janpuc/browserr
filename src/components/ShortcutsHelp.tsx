"use client";

import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useEffect } from "react";
import { ShortcutKeys } from "@/components/ui/kbd";
import { SHORTCUTS } from "@/lib/shortcuts";

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const sections = [...new Set(SHORTCUTS.map((s) => s.section))];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl"
            initial={{ scale: 0.96, y: 10, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "tween", duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">Keyboard shortcuts</h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5">
              {sections.map((section) => (
                <div key={section}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {section}
                  </h3>
                  <ul className="space-y-2">
                    {SHORTCUTS.filter((s) => s.section === section).map((s) => (
                      <li key={s.id} className="flex items-center justify-between gap-4">
                        <span className="text-sm">{s.label}</span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          {s.combos.map((combo, i) => (
                            <span key={i} className="flex items-center gap-1.5">
                              {i > 0 && <span className="text-[11px] text-muted-foreground">or</span>}
                              <ShortcutKeys keys={combo} />
                            </span>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
