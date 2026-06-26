"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Clapperboard, Settings as SettingsIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Hero } from "@/components/Hero";
import { Rail } from "@/components/Rail";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { Rail as RailModel } from "@/lib/types";

export function HomeFeed() {
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ["home"],
    queryFn: api.getHome,
    retry: false,
  });

  // Hold a single boot loader over the page until the hero's first image is
  // ready, so the first thing you see is a populated screen — not a wall of
  // shimmering placeholders. A safety timer guarantees we never hang.
  const [booted, setBooted] = useState(false);
  const reveal = useCallback(() => setBooted(true), []);

  useEffect(() => {
    if (!data) return;
    if (data.hero.length === 0) {
      setBooted(true);
      return;
    }
    const safety = setTimeout(() => setBooted(true), 2500);
    return () => clearTimeout(safety);
  }, [data]);

  if (error) {
    const status = (error as Error & { status?: number }).status;
    if (status === 503) return <SetupPrompt message={(error as Error).message} />;
    return (
      <CenteredCard
        icon={<AlertTriangle className="h-10 w-10 text-amber-400" />}
        title="Couldn’t load your feed"
        body={(error as Error).message}
      >
        <Button onClick={() => refetch()} disabled={isRefetching}>
          {isRefetching ? "Retrying…" : "Retry"}
        </Button>
      </CenteredCard>
    );
  }

  return (
    <>
      <BootSplash show={isLoading || !booted} />
      {data && (
        <div className="pb-24">
          {data.hero.length > 0 && <Hero slides={data.hero} onReady={reveal} />}
          <div className="relative z-10 mt-4 space-y-8 md:-mt-12 md:space-y-12">
            {data.rails.map((rail) => (
              <Rail key={rail.id} rail={rail} />
            ))}
            {data.rails.length > 0 && <InfiniteRails />}
            {data.rails.length === 0 && (
              <CenteredCard
                icon={<SettingsIcon className="h-10 w-10 text-muted-foreground" />}
                title="No rails yet"
                body="Pick a region and your streaming services to start browsing."
              >
                <Link href="/settings">
                  <Button>Open Settings</Button>
                </Link>
              </CenteredCard>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** Full-screen branded loader shown until the home feed's first image lands. */
function BootSplash({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-background"
        >
          <div className="flex flex-col items-center gap-5">
            <div className="relative h-16 w-16">
              <span className="absolute inset-0 rounded-full border-2 border-muted" />
              <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-accent" />
              <Clapperboard className="absolute inset-0 m-auto h-7 w-7 text-accent" />
            </div>
            <span className="text-lg font-black tracking-tight">
              Browse<span className="text-accent">rr</span>
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Sentinel-driven infinite scroll: appends pages of extended rails. */
function InfiniteRails() {
  const [rails, setRails] = useState<RailModel[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string>>(new Set());

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const res = await api.getRails(page);
      const fresh = res.rails.filter((r) => !seen.current.has(r.id));
      fresh.forEach((r) => seen.current.add(r.id));
      setRails((prev) => [...prev, ...fresh]);
      setHasMore(res.hasMore);
      setPage((p) => p + 1);
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, page]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { rootMargin: "600px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore, hasMore]);

  return (
    <>
      {rails.map((rail) => (
        <Rail key={rail.id} rail={rail} />
      ))}
      {loading && <RailRowSkeleton />}
      {hasMore && <div ref={sentinel} className="h-4" aria-hidden />}
      {!hasMore && (
        <p className="py-10 text-center text-sm text-muted-foreground">You’ve reached the end.</p>
      )}
    </>
  );
}

function RailRowSkeleton() {
  return (
    <div>
      <Skeleton className="mb-2 ml-4 h-6 w-48 md:ml-12" />
      <div className="flex gap-2.5 px-4 md:px-12">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton
            key={i}
            className="aspect-[2/3] w-[40vw] shrink-0 sm:w-[28vw] md:w-[18vw] lg:w-[14vw] xl:w-[12vw]"
          />
        ))}
      </div>
    </div>
  );
}

function SetupPrompt({ message }: { message: string }) {
  return (
    <CenteredCard
      icon={<SettingsIcon className="h-10 w-10 text-accent" />}
      title="Let’s connect your stack"
      body={message || "Add your TMDB key to start browsing, then point Browserr at Seerr."}
    >
      <Link href="/settings">
        <Button size="lg">Open Settings</Button>
      </Link>
    </CenteredCard>
  );
}

function CenteredCard({
  icon,
  title,
  body,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center">
        <div className="mb-4 flex justify-center">{icon}</div>
        <h2 className="mb-2 text-xl font-bold">{title}</h2>
        <p className="mb-6 text-sm text-muted-foreground">{body}</p>
        {children}
      </div>
    </div>
  );
}
