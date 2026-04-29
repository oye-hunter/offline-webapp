export async function deriveMasterKey(
  pin: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const pinBytes = new TextEncoder().encode(pin);
  const saltBytes = Uint8Array.from(salt);
  const pinKey = await crypto.subtle.importKey(
    "raw",
    pinBytes,
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: 310000,
      salt: saltBytes,
    },
    pinKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["wrapKey", "unwrapKey"],
  );
}

export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

export function saltToBase64(salt: Uint8Array): string {
  return btoa(String.fromCharCode(...salt));
}

export function base64ToSalt(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (character) => character.charCodeAt(0));
}