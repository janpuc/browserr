"use client";

import { useEffect, useState } from "react";

/** True on macOS / iOS (for ⌘ vs Ctrl shortcut hints). */
export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const p = navigator.platform || navigator.userAgent || "";
  return /mac|iphone|ipad|ipod/i.test(p);
}

/** Client-only mac check (returns false on the server to avoid hydration drift). */
export function useIsMac(): boolean {
  const [mac, setMac] = useState(false);
  useEffect(() => setMac(isMacPlatform()), []);
  return mac;
}

/**
 * True on touch / coarse-pointer devices. Used to hide keyboard-shortcut hints
 * and desktop-only affordances on mobile. Defaults to false until mounted.
 */
export function useIsTouch(): boolean {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const sync = () => setTouch(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return touch;
}
