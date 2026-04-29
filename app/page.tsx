"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { localDB } from "@/lib/db/dexie";
import { getCryptoKey, subscribeToCryptoKey } from "@/lib/auth/cryptoSession";
import { decryptField } from "@/lib/crypto/decrypt";
import { encryptField } from "@/lib/crypto/encrypt";

type DecryptedNote = {
  id: string;
  title: string;
  updatedAt: number;
};

export default function HomePage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [notes, setNotes] = useState<DecryptedNote[]>([]);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [sessionCryptoKey, setSessionCryptoKey] = useState<CryptoKey | null>(
    getCryptoKey(),
  );

  useEffect(() => {
    const unsubscribe = subscribeToCryptoKey(() => {
      setSessionCryptoKey(getCryptoKey());
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn) {
      setIsReady(true);
      return;
    }

    if (!sessionCryptoKey) {
      setIsReady(true);
      return;
    }

    const key = sessionCryptoKey;

    localDB.notes
      .orderBy("updatedAt")
      .reverse()
      .toArray()
      .then(async (rawNotes) => {
        const decrypted = await Promise.all(
          rawNotes.map(async (note) => ({
            id: note.id,
            title: await decryptField(note.encryptedTitle, key),
            updatedAt: note.updatedAt,
          })),
        );
        setNotes(decrypted);
        setIsReady(true);
      })
      .catch(() => {
        setIsReady(true);
      });
  }, [isLoaded, isSignedIn, sessionCryptoKey]);

  async function handleNewNote() {
    if (!sessionCryptoKey) return;

    const id = crypto.randomUUID();
    const encryptedTitle = await encryptField("", sessionCryptoKey);
    const encryptedContent = await encryptField("", sessionCryptoKey);

    await localDB.notes.put({
      id,
      encryptedTitle,
      encryptedContent,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: "pending",
    });

    router.push(`/notes/${id}`);
  }

  if (!isLoaded || !isReady) {
    return null;
  }

  if (!isSignedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <p className="mb-3 text-sm text-gray-500">Sign in to access notes.</p>
          <Link
            href="/sign-in"
            className="inline-block rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Go to Sign In
          </Link>
        </div>
      </main>
    );
  }

  if (!sessionCryptoKey) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-500">
          Unlock the app to view your notes.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notes</h1>
        <button
          onClick={handleNewNote}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          New Note
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="text-center text-sm text-gray-500">
          No notes yet. Create one!
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {notes.map((note) => (
            <Link
              key={note.id}
              href={`/notes/${note.id}`}
              className="rounded-lg border p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <p className="font-medium">{note.title || "Untitled"}</p>
              <p className="mt-1 text-xs text-gray-500">
                {new Date(note.updatedAt).toLocaleString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
