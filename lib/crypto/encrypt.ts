import { EncryptedBlob } from "@/lib/db/dexie";

export async function encryptField(
  plaintext: string,
  key: CryptoKey,
): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintextBytes = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintextBytes,
  );
  const ciphertextBytes = new Uint8Array(ciphertext);

  return {
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...ciphertextBytes)),
  };
}