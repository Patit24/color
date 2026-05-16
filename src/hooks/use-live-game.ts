"use client";

import { useEffect } from "react";
import { useGameStore } from "@/store/game-store";

export function useLiveGame() {
  const syncData = useGameStore((state) => state.syncData);
  const setRealtimeStatus = useGameStore((state) => state.setRealtimeStatus);

  const tick = useGameStore((state) => state.tick);

  useEffect(() => {
    setRealtimeStatus("connecting");
    const unsubscribe = syncData();
    
    // Local countdown tick
    const interval = setInterval(() => {
      tick();
    }, 1000);
    
    return () => {
      if (unsubscribe) unsubscribe();
      clearInterval(interval);
    };
  }, [syncData, setRealtimeStatus, tick]);
}
