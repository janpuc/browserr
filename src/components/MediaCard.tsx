"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useCallback } from "react";
import { AvailabilityBadge } from "@/components/AvailabilityBadge";
import { useDetail } from "@/components/providers/detail";
import { BlurImage } from "@/components/ui/BlurImage";
import { sendSignalBeacon } from "@/lib/api";
import { tmdbImage } from "@/lib/image";
import type { MediaSummary } from "@/lib/types";

function Poster({ src, alt }: { src: string; alt: string }) {
  return (
    <>
      <BlurImage
        src={src}
        alt=""
        fill
        sizes="(max-width: 640px) 40vw, (max-width: 1024px) 22vw, 15vw"
        className="object-cover"
      />
      <span className="sr-only">{alt}</span>
    </>
  );
}

function NoPoster({ title }: { title: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 p-3 text-center text-xs font-medium text-muted-foreground">
      {title}
    </div>
  );
}

export function MediaCard({ item, rank }: { item: MediaSummary; rank?: number }) {
  const { open } = useDetail();
  const reduce = useReducedMotion();

  const openDetail = useCallback(() => {
    sendSignalBeacon({ tmdbId: item.id, mediaType: item.mediaType, type: "detail_open" });
    open(item.mediaType, item.id);
  }, [open, item.id, item.mediaType]);

  const poster = tmdbImage(item.posterPath, "poster", "w342");

  return (
    <motion.div
      className="group relative aspect-[2/3] cursor-pointer overflow-hidden rounded-md bg-muted outline-none ring-0 ring-white/20 focus-visible:ring-2"
      role="button"
      tabIndex={0}
      aria-label={item.title}
      whileHover={reduce ? undefined : { scale: 1.04 }}
      transition={{ type: "tween", duration: 0.18 }}
      onClick={openDetail}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDetail();
        }
      }}
    >
      {poster ? <Poster src={poster} alt={item.title} /> : <NoPoster title={item.title} />}

      {rank !== undefined && (
        <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-lg font-black leading-none tabular-nums text-white shadow">
          {rank}
        </span>
      )}

      <div className="absolute right-1.5 top-1.5">
        <AvailabilityBadge mediaType={item.mediaType} id={item.id} hideWhenRequestable className="text-[10px]" />
      </div>
    </motion.div>
  );
}
