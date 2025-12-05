"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { PlayerSource } from "./Player";

type ActiveState = {
  isPlaying: boolean;
  position?: number;
};

type PlayerContextValue = {
  activeSource: { title?: string; source: PlayerSource } | null;
  setActiveSource: (payload: { title?: string; source: PlayerSource } | null) => void;
  activeState: ActiveState;
  setActiveState: (state: ActiveState) => void;
};

const PlayerContext = createContext<PlayerContextValue | undefined>(undefined);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [activeSource, setActiveSource] = useState<PlayerContextValue["activeSource"]>(null);
  const [activeState, setActiveState] = useState<ActiveState>({ isPlaying: false });

  const value = useMemo(
    () => ({
      activeSource,
      setActiveSource,
      activeState,
      setActiveState,
    }),
    [activeSource, activeState],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayerContext() {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    return {
      activeSource: null,
      setActiveSource: () => {},
      activeState: { isPlaying: false },
      setActiveState: () => {},
    };
  }
  return ctx;
}
