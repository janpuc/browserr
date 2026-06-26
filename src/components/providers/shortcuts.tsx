"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ShortcutsHelp } from "@/components/ShortcutsHelp";

/** Fired to ask the Navbar to open + focus the search box. */
export const FOCUS_SEARCH_EVENT = "browserr:focus-search";

interface ShortcutsContextValue {
  openHelp: () => void;
}

const ShortcutsContext = createContext<ShortcutsContextValue>({ openHelp: () => {} });
export const useShortcuts = () => useContext(ShortcutsContext);

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
}

export function ShortcutsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const openHelp = useCallback(() => setHelpOpen(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // ⌘/Ctrl+K focuses search even while typing elsewhere.
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        window.dispatchEvent(new Event(FOCUS_SEARCH_EVENT));
        return;
      }

      // The rest never hijack an active text field.
      if (isTyping(e.target)) return;

      if (mod && e.key === ",") {
        e.preventDefault();
        router.push("/settings");
      } else if (!mod && e.key === "/") {
        e.preventDefault();
        window.dispatchEvent(new Event(FOCUS_SEARCH_EVENT));
      } else if (!mod && e.key === "?") {
        e.preventDefault();
        setHelpOpen((v) => !v);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <ShortcutsContext.Provider value={{ openHelp }}>
      {children}
      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </ShortcutsContext.Provider>
  );
}
