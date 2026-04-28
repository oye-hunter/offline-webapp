"use client";

import { useEffect, useState } from "react";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import "./globals.css";

import { LockScreen } from "@/components/LockScreen";
import { ReAuthBanner } from "@/components/ReAuthBanner";
import { SyncStatusBadge } from "@/components/SyncStatusBadge";
import { localDB } from "@/lib/db/dexie";
import { base64ToSalt, deriveMasterKey } from "@/lib/crypto/pin";
import { unwrapCryptoKey } from "@/lib/crypto/key";
import {
  cryptoKey,
  setCryptoKey,
  clearCryptoKey,
} from "@/lib/auth/cryptoSession";
import {
  checkTTL,
  clearOfflineSession,
  getReAuthPending,
} from "@/lib/auth/offlineSession";
import { useSyncEngine } from "@/lib/sync/hooks";

// Inner component lives inside ClerkProvider so useAuth has a valid context.
function LayoutInner({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number>(5);
  const [showReAuthBanner, setShowReAuthBanner] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  useSyncEngine(cryptoKey, userId ?? null);

  // Check if a wrapped key exists on mount to decide initial lock state.
  useEffect(() => {
    localDB.wrappedKey
      .get("wrapped-crypto-key")
      .then((record) => {
        if (!record) {
          setIsLocked(false);
        }
        setIsInitialized(true);
      })
      .catch(() => {
        setIsInitialized(true);
      });
  }, []);

  // Idle lock: lock after 10 minutes of inactivity.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setIsLocked(true);
        clearCryptoKey();
      }, 600000);
    };

    window.addEventListener("pointermove", resetTimer);
    window.addEventListener("keydown", resetTimer);
    window.addEventListener("click", resetTimer);
    resetTimer();

    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      window.removeEventListener("click", resetTimer);
    };
  }, []);

  // Background lock: lock immediately when tab is hidden.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        setIsLocked(true);
        clearCryptoKey();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  async function handleUnlock(pin: string): Promise<void> {
    try {
      const record = await localDB.wrappedKey.get("wrapped-crypto-key");
      if (!record) return;

      const salt = base64ToSalt(record.salt);
      const masterKey = await deriveMasterKey(pin, salt);
      const key = await unwrapCryptoKey(record.wrappedKey, masterKey);
      setCryptoKey(key);

      const ttlResult = await checkTTL(key);
      if (ttlResult === "expired") {
        await clearOfflineSession();
        clearCryptoKey();
        setAttemptsRemaining(5);
        return;
      }

      const reAuthPending = await getReAuthPending(key);
      setShowReAuthBanner(reAuthPending);
      setIsLocked(false);
    } catch {
      const next = attemptsRemaining - 1;
      if (next <= 0) {
        clearCryptoKey();
        await localDB.wrappedKey.delete("wrapped-crypto-key").catch(() => {});
        await localDB.offlineSession.delete("offline-session").catch(() => {});
        setAttemptsRemaining(5);
      } else {
        setAttemptsRemaining(next);
      }
    }
  }

  return (
    <>
      <ReAuthBanner show={showReAuthBanner} />
      {isInitialized && isLocked && (
        <LockScreen
          onUnlock={handleUnlock}
          attemptsRemaining={attemptsRemaining}
        />
      )}
      {children}
      <SyncStatusBadge />
    </>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" className="h-full antialiased">
        <body className="flex min-h-full flex-col">
          <LayoutInner>{children}</LayoutInner>
        </body>
      </html>
    </ClerkProvider>
  );
}
