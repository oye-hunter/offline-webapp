import Dexie, { type Table } from "dexie";

export interface EncryptedBlob {
  iv: string;
  data: string;
}

export interface LocalNote {
  id: string;
  encryptedTitle: EncryptedBlob;
  encryptedContent: EncryptedBlob;
  createdAt: number;
  updatedAt: number;
  syncStatus: "pending" | "synced";
}

export interface WrappedKeyRecord {
  id: string;
  wrappedKey: string;
  salt: string;
}

export interface OfflineSessionRecord {
  id: string;
  encryptedData: EncryptedBlob;
}

export class NotesDB extends Dexie {
  notes!: Table<LocalNote>;
  wrappedKey!: Table<WrappedKeyRecord>;
  offlineSession!: Table<OfflineSessionRecord>;

  public constructor() {
    super("NotesDB");

    this.version(1).stores({
      notes: "id, syncStatus, updatedAt",
      wrappedKey: "id",
      offlineSession: "id",
    });
  }
}

export const localDB = new NotesDB();
