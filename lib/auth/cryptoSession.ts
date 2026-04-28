export let cryptoKey: CryptoKey | null = null;

export function setCryptoKey(key: CryptoKey): void {
  cryptoKey = key;
}

export function clearCryptoKey(): void {
  cryptoKey = null;
}
