"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { localDB } from "@/lib/db/dexie";
import { getCryptoKey, subscribeToCryptoKey } from "@/lib/auth/cryptoSession";
import { decryptField } from "@/lib/crypto/decrypt";
import { encryptField } from "@/lib/crypto/encrypt";

export default function NotePage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [title, setTitle] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [sessionCryptoKey, setSessionCryptoKey] = useState<CryptoKey | null>(
    getCryptoKey(),
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToCryptoKey(() => {
      setSessionCryptoKey(getCryptoKey());
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!sessionCryptoKey || !id) {
      setIsLoaded(true);
      return;
    }

    const key = sessionCryptoKey;

    localDB.notes
      .get(id)
      .then(async (note) => {
        if (!note) {
          setNotFound(true);
          setIsLoaded(true);
          return;
        }
        setTitle(await decryptField(note.encryptedTitle, key));
        setContent(await decryptField(note.encryptedContent, key));
        setIsLoaded(true);
      })
      .catch(() => {
        setNotFound(true);
        setIsLoaded(true);
      });
  }, [id, sessionCryptoKey]);

  async function persistNote(newTitle: string, newContent: string): Promise<void> {
    if (!sessionCryptoKey) return;

    const key = sessionCryptoKey;
    const now = Date.now();

    const encryptedTitle = await encryptField(newTitle, key);
    const encryptedContent = await encryptField(newContent, key);

    const updated = await localDB.notes.update(id, {
      encryptedTitle,
      encryptedContent,
      updatedAt: now,
      syncStatus: "pending",
    });

    if (updated === 0) {
      await localDB.notes.put({
        id,
        encryptedTitle,
        encryptedContent,
        createdAt: now,
        updatedAt: now,
        syncStatus: "pending",
      });
    }
  }

  function scheduleSave(newTitle: string, newContent: string) {
    if (!sessionCryptoKey) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      await persistNote(newTitle, newContent);
    }, 500);
  }

  async function handleManualSave(): Promise<void> {
    setIsSaving(true);
    try {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      await persistNote(title, content);
    } finally {
      setIsSaving(false);
    }
  }

  if (!isLoaded) {
    return null;
  }

  if (!sessionCryptoKey) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-500">
          Unlock the app to view this note.
        </p>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Link
          href="/"
          className="mb-4 inline-block text-sm text-gray-500 hover:underline"
        >
          ← Back
        </Link>
        <p className="text-sm text-gray-500">Note not found.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/" className="text-sm text-gray-500 hover:underline">
          ← Back
        </Link>
        <button
          onClick={handleManualSave}
          disabled={isSaving}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Note"}
        </button>
      </div>

      <div className="flex flex-col gap-4">
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            scheduleSave(e.target.value, content);
          }}
          placeholder="Title"
          className="w-full rounded-md border px-3 py-2 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-black"
        />
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            scheduleSave(title, e.target.value);
          }}
          placeholder="Write your note…"
          className="min-h-[60vh] w-full resize-none rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>
    </main>
  );
}
