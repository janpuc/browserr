"use client";

import NextImage, { type ImageProps } from "next/image";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * `next/image` with a shimmer placeholder that fades the image in once it has
 * loaded, so pictures never pop in over a blank box. The parent must be
 * `position: relative` (and sized) because the placeholder is absolutely
 * positioned. Images are `unoptimized` (we ship without sharp).
 *
 * The ref callback covers the case where a cached image finishes loading before
 * React attaches `onLoad` during hydration - otherwise it could stay invisible.
 */
export function BlurImage({ className, onLoad, onError, ...props }: ImageProps) {
  const [loaded, setLoaded] = useState(false);

  const captureComplete = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete) setLoaded(true);
  }, []);

  return (
    <>
      {!loaded && <span aria-hidden className="shimmer absolute inset-0 rounded-[inherit]" />}
      <NextImage
        {...props}
        ref={captureComplete}
        unoptimized
        onLoad={(e) => {
          setLoaded(true);
          onLoad?.(e);
        }}
        onError={(e) => {
          // Clear the shimmer even on failure so it can't spin forever.
          setLoaded(true);
          onError?.(e);
        }}
        className={cn("transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0", className)}
      />
    </>
  );
}
