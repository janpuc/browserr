"use client";

import { useAvailability } from "@/components/providers/availability";
import { Badge } from "@/components/ui/badge";
import { badgeForAvailability } from "@/lib/availability";
import type { MediaType } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AvailabilityBadge({
  mediaType,
  id,
  className,
  hideWhenRequestable = false,
}: {
  mediaType: MediaType;
  id: number;
  className?: string;
  /** Hide the badge for not-yet-requested titles (used on dense card grids). */
  hideWhenRequestable?: boolean;
}) {
  const availability = useAvailability(mediaType, id);
  const spec = badgeForAvailability(availability);
  // Don't flash a "Request"/"Unknown" badge before Seerr answers on dense rails.
  if (hideWhenRequestable && (!availability || spec.requestable)) return null;
  return <Badge className={cn(spec.className, "shadow", className)}>{spec.label}</Badge>;
}
