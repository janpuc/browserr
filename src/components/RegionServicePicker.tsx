"use client";

import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import Image from "next/image";
import { api } from "@/lib/api";
import { tmdbImage } from "@/lib/image";
import { cn } from "@/lib/utils";

export function RegionServicePicker({
  region,
  services,
  onRegionChange,
  onServicesChange,
  disabled,
}: {
  region: string;
  services: number[];
  onRegionChange: (region: string) => void;
  onServicesChange: (services: number[]) => void;
  disabled?: boolean;
}) {
  const regionsQ = useQuery({ queryKey: ["regions"], queryFn: api.getRegions, staleTime: 60 * 60_000 });
  const servicesQ = useQuery({
    queryKey: ["services", region],
    queryFn: () => api.getServices(region),
    enabled: !!region,
    staleTime: 30 * 60_000,
  });
  const available = servicesQ.data?.services ?? [];
  const allMode = services.length === 0;

  const toggle = (id: number) => {
    if (disabled) return;
    onServicesChange(services.includes(id) ? services.filter((s) => s !== id) : [...services, id]);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium">Region</label>
        <select
          value={region}
          disabled={disabled || regionsQ.isLoading}
          onChange={(e) => onRegionChange(e.target.value)}
          className="h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          {regionsQ.data?.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name} ({r.code})
            </option>
          ))}
          {!regionsQ.data && <option value={region}>{region}</option>}
        </select>
        <p className="mt-1 text-xs text-muted-foreground">
          Changing region re-derives the available services below.
        </p>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium">
            Services <span className="text-muted-foreground">({available.length} available in {region})</span>
          </label>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onServicesChange([])}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition",
              allMode ? "bg-accent text-accent-foreground" : "bg-muted hover:bg-muted/70",
            )}
          >
            All services
          </button>
        </div>

        {servicesQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading services…</p>
        ) : available.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No services found for this region (or TMDB isn’t configured yet).
          </p>
        ) : (
          <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-3">
            {available.map((s) => {
              const selected = services.includes(s.providerId);
              return (
                <button
                  type="button"
                  key={s.providerId}
                  onClick={() => toggle(s.providerId)}
                  disabled={disabled}
                  className={cn(
                    "flex items-center gap-2 rounded-md border p-1.5 text-left text-xs transition",
                    selected ? "border-accent bg-accent/10" : "border-border hover:bg-white/5",
                    disabled && "opacity-60",
                  )}
                >
                  <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-muted">
                    {tmdbImage(s.logoPath, "logo", "w92") && (
                      <Image src={tmdbImage(s.logoPath, "logo", "w92")!} alt="" fill sizes="32px" className="object-cover" unoptimized />
                    )}
                  </div>
                  <span className="line-clamp-2 flex-1">{s.name}</span>
                  {selected && <Check className="h-4 w-4 shrink-0 text-accent" />}
                </button>
              );
            })}
          </div>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {allMode
            ? "Showing everything available in your region."
            : `${services.length} service${services.length === 1 ? "" : "s"} selected.`}
        </p>
      </div>
    </div>
  );
}
