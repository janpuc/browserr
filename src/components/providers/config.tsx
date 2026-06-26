"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { api } from "@/lib/api";
import type { PublicConfig } from "@/lib/config";

interface ConfigContextValue {
  config: PublicConfig;
  refresh: () => Promise<void>;
  setConfig: (c: PublicConfig) => void;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

export function ConfigProvider({
  initial,
  children,
}: {
  initial: PublicConfig;
  children: React.ReactNode;
}) {
  const [config, setConfig] = useState<PublicConfig>(initial);
  const refresh = useCallback(async () => {
    setConfig(await api.getConfig());
  }, []);
  return (
    <ConfigContext.Provider value={{ config, refresh, setConfig }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("useConfig must be used within ConfigProvider");
  return ctx;
}
