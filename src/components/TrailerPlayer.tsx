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
  cover = false,
}: {
  youtubeKey: string;
  muted?: boolean;
  autoplay?: boolean;
  controls?: boolean;
  loop?: boolean;
  title?: string;
  className?: string;
  /** Background mode: hide all YouTube chrome and ignore pointer events. */
  cover?: boolean;
}) {
  const params = new URLSearchParams({
    autoplay: autoplay ? "1" : "0",
    mute: muted ? "1" : "0",
    controls: cover || !controls ? "0" : "1",
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    iv_load_policy: "3",
  });
  if (cover) {
    params.set("disablekb", "1");
    params.set("fs", "0");
  }
  if (loop) {
    params.set("loop", "1");
    params.set("playlist", youtubeKey);
  }
  const src = `https://www.youtube-nocookie.com/embed/${youtubeKey}?${params.toString()}`;

  // Cover mode: scale the iframe past its frame and clip, so YouTube's title bar,
  // logo and (hover) controls fall outside the visible area; pointer-events-none
  // stops a hover over the card from ever summoning the player UI.
  if (cover) {
    // Over-scale + clip so YouTube's chrome falls outside the frame. The frame is
    // biased upward (top:44%) so the title/channel text in the TOP-LEFT is cropped
    // harder than the bottom; pointer-events-none keeps hover UI from ever showing.
    return (
      <div className={cn("relative h-full w-full overflow-hidden", className)}>
        <iframe
          className="pointer-events-none absolute left-1/2 top-[44%] h-[138%] w-[138%] -translate-x-1/2 -translate-y-1/2 border-0"
          src={src}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture"
          loading="lazy"
        />
      </div>
    );
  }

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
