import { localDB, type LocalNote } from "@/lib/db/dexie";
import { decryptField } from "@/lib/crypto/decrypt";

type SyncPayloadItem = {
  id: string;
  userId: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
};

export async function flushPendingNotes(
  key: CryptoKey,
  userId: string,
): Promise<void> {
  const pending = await localDB.notes
    .where("syncStatus")
    .equals("pending")
    .toArray();

  if (pending.length === 0) {
    return;
  }

  const payload: SyncPayloadItem[] = await Promise.all(
    pending.map(async (note: LocalNote) => ({
      id: note.id,
      userId,
      title: await decryptField(note.encryptedTitle, key),
      content: await decryptField(note.encryptedContent, key),
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    })),
  );

  const response = await fetch("/api/sync/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Sync failed: ${response.statusText}`);
  }

  await localDB.notes.bulkPut(
    pending.map((note: LocalNote) => ({ ...note, syncStatus: "synced" as const })),
  );
}
