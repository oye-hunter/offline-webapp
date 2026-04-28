"use client";

import { useState } from "react";

interface LockScreenProps {
  onUnlock: (pin: string) => Promise<void>;
  attemptsRemaining: number;
}

export function LockScreen({ onUnlock, attemptsRemaining }: LockScreenProps) {
  const [pin, setPin] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    try {
      await onUnlock(pin);
    } finally {
      setPin("");
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-lg border bg-card p-8 shadow-lg">
        <h1 className="mb-6 text-center text-xl font-semibold">
          Enter your PIN
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-ring"
            autoComplete="current-password"
            disabled={isLoading}
          />

          {attemptsRemaining < 5 && (
            <p className="text-center text-sm text-destructive">
              Incorrect PIN. {attemptsRemaining} attempt(s) remaining.
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading || pin.length === 0}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {isLoading ? "Unlocking\u2026" : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
