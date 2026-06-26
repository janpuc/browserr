"use client";

import { useIsMac } from "@/lib/platform";
import { cn } from "@/lib/utils";

/** A single key cap. */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border border-border bg-muted px-1.5 font-sans text-[11px] font-semibold leading-none text-muted-foreground",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

function renderKey(key: string, mac: boolean): string {
  switch (key) {
    case "mod":
      return mac ? "⌘" : "Ctrl";
    case "shift":
      return mac ? "⇧" : "Shift";
    case "alt":
      return mac ? "⌥" : "Alt";
    case "enter":
      return "↵";
    default:
      return key;
  }
}

/** Renders a platform-aware key combo, e.g. ["mod","K"] → ⌘ K on mac, Ctrl K elsewhere. */
export function ShortcutKeys({ keys, className }: { keys: string[]; className?: string }) {
  const mac = useIsMac();
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {keys.map((k, i) => (
        <Kbd key={i}>{renderKey(k, mac)}</Kbd>
      ))}
    </span>
  );
}
