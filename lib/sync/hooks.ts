"use client";

import { useEffect, useRef, useState } from "react";
import { flushPendingNotes } from "@/lib/sync/engine";

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

export function useSyncEngine(
  key: CryptoKey | null,
  userId: string | null,
): void {
  const isOnline = useOnlineStatus();
  const wasOnlineRef = useRef<boolean>(isOnline);
  const wasReadyRef = useRef<boolean>(Boolean(key && userId));

  useEffect(() => {
    const isReady = Boolean(key && userId);
    const becameOnline = !wasOnlineRef.current && isOnline;
    const becameReadyWhileOnline = !wasReadyRef.current && isReady && isOnline;

    if ((becameOnline || becameReadyWhileOnline) && key && userId) {
      flushPendingNotes(key, userId).catch(() => {
        // Sync failure must never crash the UI — discard silently.
      });
    }

    wasOnlineRef.current = isOnline;
    wasReadyRef.current = isReady;
  }, [isOnline, key, userId]);
}
