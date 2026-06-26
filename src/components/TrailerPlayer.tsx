"use client";

import { cn } from "@/lib/utils";

/** Privacy-friendly YouTube embed (youtube-nocookie). */
export function TrailerPlayer({
  youtubeKey,
  muted = true,
  autoplay = true,
  controls = false,
  loop = false,
  title = "Trailer",
  className,
}: {
  youtubeKey: string;
  muted?: boolean;
  autoplay?: boolean;
  controls?: boolean;
  loop?: boolean;
  title?: string;
  className?: string;
}) {
  const params = new URLSearchParams({
    autoplay: autoplay ? "1" : "0",
    mute: muted ? "1" : "0",
    controls: controls ? "1" : "0",
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    iv_load_policy: "3",
  });
  if (loop) {
    params.set("loop", "1");
    params.set("playlist", youtubeKey);
  }
  const src = `https://www.youtube-nocookie.com/embed/${youtubeKey}?${params.toString()}`;

  return (
    <iframe
      className={cn("h-full w-full border-0", className)}
      src={src}
      title={title}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      loading="lazy"
    />
  );
}
