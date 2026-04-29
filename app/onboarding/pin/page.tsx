"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

import { setCryptoKey } from "@/lib/auth/cryptoSession";
import { localDB } from "@/lib/db/dexie";
import { generateCryptoKey, wrapCryptoKey } from "@/lib/crypto/key";
import { deriveMasterKey, generateSalt, saltToBase64 } from "@/lib/crypto/pin";

const WRAPPED_KEY_ID = "wrapped-crypto-key";

export default function PinOnboardingPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [pin, setPin] = useState<string>("");
  const [confirmPin, setConfirmPin] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn) {
      router.replace("/sign-in");
      return;
    }

    localDB.wrappedKey.get(WRAPPED_KEY_ID).then((record) => {
      if (record) {
        router.replace("/");
      }
    });
  }, [isLoaded, isSignedIn, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError("");

    if (!/^\d{6}$/.test(pin)) {
      setError("PIN must be exactly 6 digits.");
      return;
    }

    if (pin !== confirmPin) {
      setError("PIN and confirmation do not match.");
      return;
    }

    setIsSaving(true);

    try {
      const salt = generateSalt();
      const masterKey = await deriveMasterKey(pin, salt);
      const cryptoKey = await generateCryptoKey();
      const wrappedKey = await wrapCryptoKey(cryptoKey, masterKey);

      await localDB.wrappedKey.put({
        id: WRAPPED_KEY_ID,
        wrappedKey,
        salt: saltToBase64(salt),
      });

      setCryptoKey(cryptoKey);
      router.replace("/");
    } catch {
      setError("Failed to set PIN. Please try again.");
    } finally {
      setPin("");
      setConfirmPin("");
      setIsSaving(false);
    }
  }

  if (!isLoaded || !isSignedIn) {
    return null;
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border bg-card p-8 shadow-lg">
        <h1 className="mb-2 text-center text-xl font-semibold">Set Your PIN</h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          This PIN unlocks your encrypted offline notes.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="6-digit PIN"
            autoComplete="new-password"
            disabled={isSaving}
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={confirmPin}
            onChange={(event) => setConfirmPin(event.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Confirm PIN"
            autoComplete="new-password"
            disabled={isSaving}
          />

          {error && <p className="text-center text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={isSaving}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save PIN"}
          </button>
        </form>
      </div>
    </main>
  );
}
