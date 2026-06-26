"use client";

import { useCallback } from "react";
import { useAvailabilityStore } from "@/components/providers/availability";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { MEDIA_STATUS, type MediaType } from "@/lib/types";

/**
 * Perform a request via the BFF. In `redirect` mode the server returns the
 * EXTERNAL Seerr deep link (the internal URL never reaches the client) and we
 * open it in a new tab. In `proxy` mode the server submits it. Either way we
 * optimistically flip the badge to "Requested".
 */
export function useRequestAction() {
  const { toast } = useToast();
  const { set: setAvailability } = useAvailabilityStore();

  return useCallback(
    async (item: { tmdbId: number; mediaType: MediaType; title: string; seasons?: number[] | "all" }) => {
      try {
        const res = await api.request({
          tmdbId: item.tmdbId,
          mediaType: item.mediaType,
          seasons: item.seasons,
        });
        // Optimistic badge update (pending/requested).
        setAvailability(item.mediaType, item.tmdbId, { status: MEDIA_STATUS.PENDING, known: true });

        if (res.mode === "redirect" && res.redirectUrl) {
          window.open(res.redirectUrl, "_blank", "noopener,noreferrer");
          toast({ title: "Opening Seerr", description: "Finish your request there." });
        } else {
          toast({ title: "Requested", description: item.title, variant: "success" });
        }
      } catch (err) {
        toast({
          title: "Request failed",
          description: err instanceof Error ? err.message : "Try again",
          variant: "error",
        });
      }
    },
    [toast, setAvailability],
  );
}
