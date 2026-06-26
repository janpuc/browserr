"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AvailabilityProvider } from "@/components/providers/availability";
import { ConfigProvider } from "@/components/providers/config";
import { DetailProvider } from "@/components/providers/detail";
import { ToastProvider } from "@/components/ui/toast";
import type { PublicConfig } from "@/lib/config";

export function Providers({
  initialConfig,
  children,
}: {
  initialConfig: PublicConfig;
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider initial={initialConfig}>
        <ToastProvider>
          <AvailabilityProvider>
            <DetailProvider>{children}</DetailProvider>
          </AvailabilityProvider>
        </ToastProvider>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
