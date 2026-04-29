export let cryptoKey: CryptoKey | null = null;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

export function getCryptoKey(): CryptoKey | null {
  return cryptoKey;
}

export function subscribeToCryptoKey(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function setCryptoKey(key: CryptoKey): void {
  cryptoKey = key;
  notifyListeners();
}

export function clearCryptoKey(): void {
  cryptoKey = null;
  notifyListeners();
}
