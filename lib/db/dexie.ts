import Dexie, { type Table } from "dexie";

export type SyncStatus = "pending" | "synced";

export type EncryptedBlob = {
  iv: string;
  data: string;
};

export type NoteRecord = {
  id: string;
  encryptedTitle: EncryptedBlob;
  encryptedContent: EncryptedBlob;
  createdAt: number;
  updatedAt: number;
  syncStatus: SyncStatus;
};

export type WrappedKeyRecord = {
  id: "wrapped-crypto-key";
  wrappedKey: string;
  salt: string;
};

export type OfflineSessionRecord = {
  id: "offline-session";
  encryptedData: EncryptedBlob;
};

export class OfflinePwaDexie extends Dexie {
  notes!: Table<NoteRecord, string>;
  wrappedKeys!: Table<WrappedKeyRecord, "wrapped-crypto-key">;
  offlineSessions!: Table<OfflineSessionRecord, "offline-session">;

  public constructor() {
    super("offline-pwa-db");

    this.version(1).stores({
      notes: "id, updatedAt, syncStatus",
      wrappedKeys: "id",
      offlineSessions: "id",
    });
  }
}

export const localDb = new OfflinePwaDexie();
