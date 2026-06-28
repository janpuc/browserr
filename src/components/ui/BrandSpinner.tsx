"use client";

import { Clapperboard } from "lucide-react";

/**
 * The branded loading mark: a spinning accent ring around the clapperboard,
 * with an optional wordmark. Shared by the initial boot splash and the
 * pull-to-refresh overlay so a refresh looks exactly like a fresh load.
 */
export function BrandSpinner({ label = true }: { label?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative h-16 w-16">
        <span className="absolute inset-0 rounded-full border-2 border-muted" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-accent" />
        <Clapperboard className="absolute inset-0 m-auto h-7 w-7 text-accent" />
      </div>
      {label && (
        <span className="text-lg font-black tracking-tight">
          Browse<span className="text-accent">rr</span>
        </span>
      )}
    </div>
  );
}
