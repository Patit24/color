"use client";

import { useEffect } from "react";
import { useGameStore } from "@/store/game-store";

export function useLiveGame() {
  const syncData = useGameStore((state) => state.syncData);
  const setRealtimeStatus = useGameStore((state) => state.setRealtimeStatus);

  useEffect(() => {
    setRealtimeStatus("connecting");
    const unsubscribe = syncData();
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [syncData, setRealtimeStatus]);
}
