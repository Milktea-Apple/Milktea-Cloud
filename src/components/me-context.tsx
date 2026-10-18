"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/client/api";
import { onFilesChanged } from "@/lib/client/events";
import type { MeDTO } from "@/lib/shared";

type MeContextValue = {
  me: MeDTO;
  refreshMe: () => Promise<void>;
};

const MeContext = createContext<MeContextValue | null>(null);

export function MeProvider({ initial, children }: { initial: MeDTO; children: ReactNode }) {
  const [me, setMe] = useState(initial);

  const refreshMe = useCallback(async () => {
    try {
      const next = await api<MeDTO>("/api/me");
      setMe(next);
    } catch {
      // Authentication failures are handled by the surrounding page.
    }
  }, []);

  useEffect(() => onFilesChanged(() => void refreshMe()), [refreshMe]);

  const value = useMemo(() => ({ me, refreshMe }), [me, refreshMe]);
  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
}

export function useMe() {
  const context = useContext(MeContext);
  if (!context) throw new Error("useMe must be used inside MeProvider");
  return context;
}
