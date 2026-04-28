const WRAP_IV = new Uint8Array(12);
const KEY_USAGES: KeyUsage[] = ["encrypt", "decrypt", "wrapKey", "unwrapKey"];

export async function generateCryptoKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    KEY_USAGES,
  );
}

export async function wrapCryptoKey(
  cryptoKey: CryptoKey,
  masterKey: CryptoKey,
): Promise<string> {
  const wrappedKey = await crypto.subtle.wrapKey(
    "raw",
    cryptoKey,
    masterKey,
    {
      name: "AES-GCM",
      // A fixed zero IV is only used for wrapping because the master key is unique per PIN derivation.
      iv: WRAP_IV,
    },
  );

  return btoa(String.fromCharCode(...new Uint8Array(wrappedKey)));
}

export async function unwrapCryptoKey(
  wrappedKeyB64: string,
  masterKey: CryptoKey,
): Promise<CryptoKey> {
  const wrappedKeyBytes = Uint8Array.from(atob(wrappedKeyB64), (character) =>
    character.charCodeAt(0),
  );

  return crypto.subtle.unwrapKey(
    "raw",
    wrappedKeyBytes,
    masterKey,
    {
      name: "AES-GCM",
      iv: WRAP_IV,
    },
    {
      name: "AES-GCM",
    },
    true,
    KEY_USAGES,
  );
}