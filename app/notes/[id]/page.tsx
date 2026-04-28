"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { localDB } from "@/lib/db/dexie";
import { cryptoKey } from "@/lib/auth/cryptoSession";
import { decryptField } from "@/lib/crypto/decrypt";
import { encryptField } from "@/lib/crypto/encrypt";

export default function NotePage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [title, setTitle] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [notFound, setNotFound] = useState<boolean>(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!cryptoKey || !id) {
      setIsLoaded(true);
      return;
    }

    const key = cryptoKey;

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
  }, [id]);

  function scheduleSave(newTitle: string, newContent: string) {
    if (!cryptoKey) return;

    const key = cryptoKey;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      const encryptedTitle = await encryptField(newTitle, key);
      const encryptedContent = await encryptField(newContent, key);

      await localDB.notes.update(id, {
        encryptedTitle,
        encryptedContent,
        updatedAt: Date.now(),
        syncStatus: "pending",
      });
    }, 500);
  }

  if (!isLoaded) {
    return null;
  }

  if (!cryptoKey) {
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
      <Link
        href="/"
        className="mb-4 inline-block text-sm text-gray-500 hover:underline"
      >
        ← Back
      </Link>

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
