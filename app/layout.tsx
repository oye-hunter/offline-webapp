"use client";

import { useEffect, useState } from "react";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import "./globals.css";

import { LockScreen } from "@/components/LockScreen";
import { ReAuthBanner } from "@/components/ReAuthBanner";
import { SyncStatusBadge } from "@/components/SyncStatusBadge";
import { localDB } from "@/lib/db/dexie";
import { base64ToSalt, deriveMasterKey } from "@/lib/crypto/pin";
import { unwrapCryptoKey } from "@/lib/crypto/key";
import {
  getCryptoKey,
  subscribeToCryptoKey,
  setCryptoKey,
  clearCryptoKey,
} from "@/lib/auth/cryptoSession";
import {
  checkTTL,
  clearOfflineSession,
  getReAuthPending,
} from "@/lib/auth/offlineSession";
import { useSyncEngine } from "@/lib/sync/hooks";

const ONBOARDING_PIN_PATH = "/onboarding/pin";

// Inner component lives inside ClerkProvider so useAuth has a valid context.
function LayoutInner({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number>(5);
  const [showReAuthBanner, setShowReAuthBanner] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [hasWrappedKey, setHasWrappedKey] = useState<boolean>(false);
  const [sessionCryptoKey, setSessionCryptoKey] = useState<CryptoKey | null>(
    getCryptoKey(),
  );

  useSyncEngine(sessionCryptoKey, userId ?? null);

  useEffect(() => {
    const unsubscribe = subscribeToCryptoKey(() => {
      setSessionCryptoKey(getCryptoKey());
    });

    return unsubscribe;
  }, []);

  // Unauthenticated users must be able to access Clerk auth routes.
  useEffect(() => {
    if (!isLoaded || isSignedIn) {
      return;
    }

    clearCryptoKey();
    setShowReAuthBanner(false);
    setIsLocked(false);
  }, [isLoaded, isSignedIn]);

  // Check wrapped key status on mount and route changes.
  useEffect(() => {
    let cancelled = false;

    localDB.wrappedKey
      .get("wrapped-crypto-key")
      .then((record) => {
        if (cancelled) {
          return;
        }

        setHasWrappedKey(Boolean(record));

        if (!record) {
          clearCryptoKey();
          setIsLocked(false);
        } else if (getCryptoKey()) {
          // If key is already available in memory, keep the session unlocked.
          setIsLocked(false);
        }

        setIsInitialized(true);
      })
      .catch(() => {
        if (!cancelled) {
          setIsInitialized(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !isInitialized) {
      return;
    }

    if (!hasWrappedKey && pathname !== ONBOARDING_PIN_PATH) {
      router.replace(ONBOARDING_PIN_PATH);
      return;
    }

    if (hasWrappedKey && pathname === ONBOARDING_PIN_PATH) {
      router.replace("/");
    }
  }, [hasWrappedKey, isInitialized, isLoaded, isSignedIn, pathname, router]);

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
      {isInitialized && isSignedIn && hasWrappedKey && isLocked && (
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
        <head>
          <link rel="manifest" href="/manifest.json" />
          <meta name="theme-color" content="#000000" />
        </head>
        <body className="flex min-h-full flex-col">
          <LayoutInner>{children}</LayoutInner>
        </body>
      </html>
    </ClerkProvider>
  );
}
