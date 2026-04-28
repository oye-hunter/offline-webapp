"use client";

import { useEffect, useRef, useState } from "react";
import { flushPendingNotes } from "@/lib/sync/engine";

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
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

  useEffect(() => {
    const becameOnline = !wasOnlineRef.current && isOnline;

    if (becameOnline && key && userId) {
      flushPendingNotes(key, userId).catch(() => {
        // Sync failure must never crash the UI — discard silently.
      });
    }

    wasOnlineRef.current = isOnline;
  }, [isOnline, key, userId]);
}
