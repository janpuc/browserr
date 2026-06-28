"use client";

import { useQuery } from "@tanstack/react-query";
import { Clapperboard, Keyboard, Search, Settings as SettingsIcon, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useConfig } from "@/components/providers/config";
import { useDetail } from "@/components/providers/detail";
import { FOCUS_SEARCH_EVENT, useShortcuts } from "@/components/providers/shortcuts";
import { BlurImage } from "@/components/ui/BlurImage";
import { ShortcutKeys } from "@/components/ui/kbd";
import { api } from "@/lib/api";
import { tmdbImage } from "@/lib/image";
import { useIsTouch } from "@/lib/platform";
import { cn } from "@/lib/utils";

export function Navbar() {
  const { config } = useConfig();
  const { open } = useDetail();
  const { openHelp } = useShortcuts();
  const touch = useIsTouch();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const lastY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 24);
      // On touch/mobile, hide the bar on scroll-down and reveal it on scroll-up.
      if (touch && !searchOpen) {
        if (y > lastY.current + 6 && y > 80) setHidden(true);
        else if (y < lastY.current - 6) setHidden(false);
      } else {
        setHidden(false);
      }
      lastY.current = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [touch, searchOpen]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const openSearch = () => {
    setSearchOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };
  const closeSearch = () => {
    setSearchOpen(false);
    setQ("");
    setDebounced("");
  };

  // ⌘/Ctrl+K and "/" (dispatched by ShortcutsProvider) open + focus search.
  useEffect(() => {
    const onFocusSearch = () => openSearch();
    window.addEventListener(FOCUS_SEARCH_EVENT, onFocusSearch);
    return () => window.removeEventListener(FOCUS_SEARCH_EVENT, onFocusSearch);
  }, []);

  // Click outside the search area rolls it back and defocuses.
  useEffect(() => {
    if (!searchOpen) return;
    const onDown = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) closeSearch();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [searchOpen]);

  const { data, isFetching } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => api.search(debounced),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
  });
  const results = data?.results ?? [];
  const query = q.trim();
  const showDropdown = searchOpen && query.length >= 1;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[transform,background-color] duration-300",
        hidden && "-translate-y-full",
        scrolled || searchOpen
          ? "bg-background/95 backdrop-blur"
          : "bg-gradient-to-b from-black/70 to-transparent",
      )}
    >
      <div className="flex h-14 items-center gap-4 px-4 md:h-16 md:px-12">
        <Link href="/" className="flex items-center gap-2 font-black tracking-tight">
          <Clapperboard className="h-6 w-6 text-accent" />
          <span className="text-xl">
            Browse<span className="text-accent">rr</span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <div ref={searchRef} className="relative">
            {searchOpen ? (
              <div className="flex w-56 items-center rounded-full border border-border bg-black/60 px-2 transition-all focus-within:ring-2 focus-within:ring-accent/40 md:w-72">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && closeSearch()}
                  placeholder="Search titles…"
                  className="h-9 w-full bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
                />
                <button
                  aria-label="Close search"
                  onClick={closeSearch}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                aria-label="Search"
                onClick={openSearch}
                className={cn(
                  "flex h-9 items-center rounded-full border border-transparent text-foreground transition hover:bg-white/10",
                  touch ? "w-9 justify-center" : "gap-2 pl-2.5 pr-2",
                )}
              >
                <Search className="h-5 w-5" />
                {!touch && <ShortcutKeys keys={["mod", "K"]} />}
              </button>
            )}

            {showDropdown && (
              <div className="absolute right-0 mt-2 max-h-[70vh] w-[min(90vw,420px)] overflow-y-auto overscroll-contain rounded-lg border border-border bg-popover p-2 shadow-2xl">
                {query.length < 2 ? (
                  <p className="px-2 py-3 text-sm text-muted-foreground">Keep typing to search…</p>
                ) : isFetching && results.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-muted-foreground">Searching…</p>
                ) : results.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-muted-foreground">
                    No matches for “{query}”.
                  </p>
                ) : (
                  results.slice(0, 12).map((r) => (
                    <button
                      key={`${r.mediaType}:${r.id}`}
                      onClick={() => {
                        open(r.mediaType, r.id);
                        closeSearch();
                      }}
                      className="flex w-full items-center gap-3 rounded-md p-1.5 text-left hover:bg-white/10"
                    >
                      <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded bg-muted">
                        {tmdbImage(r.posterPath, "poster", "w92") && (
                          <BlurImage
                            src={tmdbImage(r.posterPath, "poster", "w92")!}
                            alt=""
                            fill
                            sizes="44px"
                            className="object-cover"
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="line-clamp-1 text-sm font-medium">{r.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.year ?? "-"} · {r.mediaType.toUpperCase()}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {!touch && (
            <button
              onClick={openHelp}
              title="Keyboard shortcuts (?)"
              aria-label="Keyboard shortcuts"
              className="hidden h-9 w-9 items-center justify-center rounded-full border border-border bg-black/40 text-muted-foreground transition hover:bg-white/10 hover:text-foreground md:flex"
            >
              <Keyboard className="h-4 w-4" />
            </button>
          )}

          <Link
            href="/settings"
            className="flex items-center gap-1.5 rounded-full border border-border bg-black/40 px-3 py-1.5 text-xs font-semibold transition hover:bg-white/10"
            title="Region & settings"
          >
            <span className="hidden sm:inline">{config.region.region}</span>
            <SettingsIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
