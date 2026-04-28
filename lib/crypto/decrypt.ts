import { EncryptedBlob } from "@/lib/db/dexie";

export async function decryptField(
  blob: EncryptedBlob,
  key: CryptoKey,
): Promise<string> {
  const iv = Uint8Array.from(atob(blob.iv), (character) =>
    character.charCodeAt(0),
  );
  const data = Uint8Array.from(atob(blob.data), (character) =>
    character.charCodeAt(0),
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  );

  return new TextDecoder().decode(plaintext);
}