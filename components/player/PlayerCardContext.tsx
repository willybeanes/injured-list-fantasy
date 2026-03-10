"use client";

import { createContext, useContext, useState } from "react";
import { PlayerCardModal } from "./PlayerCardModal";

interface PlayerCardContextType {
  openPlayerCard: (id: number) => void;
}

const PlayerCardContext = createContext<PlayerCardContextType>({
  openPlayerCard: () => {},
});

export function usePlayerCard() {
  return useContext(PlayerCardContext);
}

export function PlayerCardProvider({ children }: { children: React.ReactNode }) {
  const [playerId, setPlayerId] = useState<number | null>(null);

  return (
    <PlayerCardContext.Provider value={{ openPlayerCard: setPlayerId }}>
      {children}
      {playerId !== null && (
        <PlayerCardModal playerId={playerId} onClose={() => setPlayerId(null)} />
      )}
    </PlayerCardContext.Provider>
  );
}
