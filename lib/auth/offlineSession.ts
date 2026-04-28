import { localDB } from "@/lib/db/dexie";
import { decryptField } from "@/lib/crypto/decrypt";
import { encryptField } from "@/lib/crypto/encrypt";

interface OfflineSessionData {
  offlineSessionStart: number;
  reAuthPending: boolean;
}

const OFFLINE_SESSION_ID = "offline-session";
const DEFAULT_TTL_MS = 18000000;

async function readOfflineSessionData(
  key: CryptoKey,
): Promise<OfflineSessionData | null> {
  const record = await localDB.offlineSession.get(OFFLINE_SESSION_ID);

  if (!record) {
    return null;
  }

  const decrypted = await decryptField(record.encryptedData, key);

  return JSON.parse(decrypted) as OfflineSessionData;
}

async function writeOfflineSessionData(
  sessionData: OfflineSessionData,
  key: CryptoKey,
): Promise<void> {
  const blob = await encryptField(JSON.stringify(sessionData), key);

  await localDB.offlineSession.put({
    id: OFFLINE_SESSION_ID,
    encryptedData: blob,
  });
}

export async function startOfflineSession(key: CryptoKey): Promise<void> {
  await writeOfflineSessionData(
    {
      offlineSessionStart: Date.now(),
      reAuthPending: false,
    },
    key,
  );
}

export async function markReAuthPending(key: CryptoKey): Promise<void> {
  const sessionData = (await readOfflineSessionData(key)) ?? {
    offlineSessionStart: Date.now(),
    reAuthPending: false,
  };

  sessionData.reAuthPending = true;

  await writeOfflineSessionData(sessionData, key);
}

export async function checkTTL(
  key: CryptoKey,
): Promise<"valid" | "expired" | "no-session"> {
  const sessionData = await readOfflineSessionData(key);

  if (!sessionData) {
    return "no-session";
  }

  const ttlMs = Number(
    process.env.NEXT_PUBLIC_OFFLINE_SESSION_TTL_MS ?? DEFAULT_TTL_MS,
  );

  if (Date.now() - sessionData.offlineSessionStart > ttlMs) {
    return "expired";
  }

  return "valid";
}

export async function getReAuthPending(key: CryptoKey): Promise<boolean> {
  const sessionData = await readOfflineSessionData(key);

  return sessionData?.reAuthPending ?? false;
}

export async function clearOfflineSession(): Promise<void> {
  await localDB.offlineSession.delete(OFFLINE_SESSION_ID);
}