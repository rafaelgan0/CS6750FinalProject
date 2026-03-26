"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

type SoundContextValue = {
  muted: boolean;
  setMuted: Dispatch<SetStateAction<boolean>>;
};

const SoundContext = createContext<SoundContextValue | null>(null);

export function SoundProvider({
  children,
  initialMuted = true,
}: {
  children: React.ReactNode;
  initialMuted?: boolean;
}) {
  const [muted, setMuted] = useState<boolean>(initialMuted);

  const value = useMemo(() => ({ muted, setMuted }), [muted]);

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound() {
  const ctx = useContext(SoundContext);
  if (!ctx) {
    throw new Error("useSound must be used within a SoundProvider");
  }
  return ctx;
}

