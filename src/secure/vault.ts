// BI_CLIENT_v789_AT_REST_ENCRYPTION
// Applicant data kept on the phone (cached screens, saves waiting to send and
// queued contract files) is sealed with AES-GCM before it reaches Preferences
// or localStorage. The 256-bit key lives in the Keychain (iOS) / Keystore
// (Android) through @aparajita/capacitor-secure-storage, the same store that
// holds the sign-in token. A browser keeps a non-extractable key in IndexedDB,
// or only in memory where IndexedDB is unavailable.
// Forgetting the key on sign-out makes anything left behind unreadable.
import { Capacitor } from "@capacitor/core";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";

export const DATA_KEY_NAME = "boreal_bi_data_key";
const SEALED_PREFIX = "bi-enc1:";
const IDB_NAME = "boreal_bi_vault";
const IDB_STORE = "keys";

let keyPromise: Promise<CryptoKey> | null = null;

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error("webcrypto_unavailable");
  return s;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function openIdb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") { resolve(null); return; }
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

function idbRequest<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  return new Promise((resolve) => {
    try {
      const req = run(db.transaction(IDB_STORE, mode).objectStore(IDB_STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => resolve(undefined);
    } catch { resolve(undefined); }
  });
}

async function nativeKey(): Promise<CryptoKey> {
  const stored = await SecureStorage.get(DATA_KEY_NAME);
  let raw: Uint8Array;
  if (typeof stored === "string" && stored) {
    raw = base64ToBytes(stored);
  } else {
    raw = globalThis.crypto.getRandomValues(new Uint8Array(32));
    await SecureStorage.set(DATA_KEY_NAME, bytesToBase64(raw));
  }
  return subtle().importKey("raw", raw as BufferSource, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function browserKey(): Promise<CryptoKey> {
  const db = await openIdb();
  if (db) {
    const existing = await idbRequest<CryptoKey>(db, "readonly", (s) => s.get(DATA_KEY_NAME));
    if (existing) return existing;
  }
  const key = await subtle().generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  if (db) await idbRequest(db, "readwrite", (s) => s.put(key, DATA_KEY_NAME));
  return key;
}

function dataKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    keyPromise = (Capacitor.isNativePlatform() ? nativeKey() : browserKey()).catch((err) => {
      keyPromise = null;
      throw err;
    });
  }
  return keyPromise;
}

export function isSealed(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(SEALED_PREFIX);
}

/** AES-GCM with a fresh 96-bit IV per value. Throws when no key can be made: callers then store nothing. */
export async function seal(plain: string): Promise<string> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const data = await subtle().encrypt({ name: "AES-GCM", iv }, await dataKey(), new TextEncoder().encode(plain));
  return `${SEALED_PREFIX}${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(data))}`;
}

/** Null for anything missing, unsealed (old plaintext), tampered with or sealed under a forgotten key. */
export async function unseal(sealed: string | null | undefined): Promise<string | null> {
  if (!isSealed(sealed)) return null;
  try {
    const [ivB64, dataB64] = sealed.slice(SEALED_PREFIX.length).split(":");
    if (!ivB64 || !dataB64) return null;
    const plain = await subtle().decrypt({ name: "AES-GCM", iv: base64ToBytes(ivB64) as BufferSource }, await dataKey(), base64ToBytes(dataB64) as BufferSource);
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

/** Sign-out: drop the key so nothing sealed under it can be read again. */
export async function forgetDataKey(): Promise<void> {
  keyPromise = null;
  if (Capacitor.isNativePlatform()) {
    try { await SecureStorage.remove(DATA_KEY_NAME); } catch { /* nothing stored */ }
    return;
  }
  const db = await openIdb();
  if (db) await idbRequest(db, "readwrite", (s) => s.delete(DATA_KEY_NAME));
}
