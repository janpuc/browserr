"use client";

import { useQuery } from "@tanstack/react-query";
import { Clapperboard, Search, Settings as SettingsIcon, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useConfig } from "@/components/providers/config";
import { useDetail } from "@/components/providers/detail";
import { BlurImage } from "@/components/ui/BlurImage";
import { api } from "@/lib/api";
import { tmdbImage } from "@/lib/image";
import { cn } from "@/lib/utils";

export function Navbar() {
  const { config } = useConfig();
  const { open } = useDetail();
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => api.search(debounced),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
  });
  const results = data?.results ?? [];

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled || searchOpen ? "bg-background/95 backdrop-blur" : "bg-gradient-to-b from-black/70 to-transparent",
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
          <div className="relative">
            <div
              className={cn(
                "flex items-center rounded-full border transition-all",
                searchOpen ? "w-56 border-border bg-black/60 px-3 md:w-72" : "w-9 border-transparent",
              )}
            >
              <button
                aria-label="Search"
                onClick={() => {
                  setSearchOpen((v) => !v);
                  setTimeout(() => inputRef.current?.focus(), 50);
                }}
                className="flex h-9 w-9 items-center justify-center"
              >
                {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
              </button>
              {searchOpen && (
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search titles…"
                  className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              )}
            </div>

            {searchOpen && results.length > 0 && (
              <div className="absolute right-0 mt-2 max-h-[70vh] w-[min(90vw,420px)] overflow-y-auto rounded-lg border border-border bg-popover p-2 shadow-2xl">
                {results.slice(0, 12).map((r) => (
                  <button
                    key={`${r.mediaType}:${r.id}`}
                    onClick={() => {
                      open(r.mediaType, r.id);
                      setSearchOpen(false);
                      setQ("");
                    }}
                    className="flex w-full items-center gap-3 rounded-md p-1.5 text-left hover:bg-white/10"
                  >
                    <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded bg-muted">
                      {tmdbImage(r.posterPath, "poster", "w92") && (
                        <BlurImage src={tmdbImage(r.posterPath, "poster", "w92")!} alt="" fill sizes="44px" className="object-cover" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-sm font-medium">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.year ?? "-"} · {r.mediaType.toUpperCase()}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

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
