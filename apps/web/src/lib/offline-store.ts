/**
 * Copia local en IndexedDB (ADR-011): base `luca`, almacén `snapshots`, una copia por email. Todo falla en silencio
 * (navegación privada, sin IndexedDB): sin copia, la web funciona igual que antes.
 */
import type { Snapshot } from "./offline.ts";

const DB = "luca";
const STORE = "snapshots";

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: "email" }); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return open().then((db) => new Promise<T | null>((resolve) => {
    if (!db) return resolve(null);
    try {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
    } catch { db.close(); resolve(null); }
  }));
}

export const saveSnapshot = (snap: Snapshot<unknown, { id: string }>) => run("readwrite", (s) => s.put(snap)).then(() => undefined);

export const loadSnapshot = <S extends Snapshot<unknown, { id: string }>>(email: string) => run<S>("readonly", (s) => s.get(email) as IDBRequest<S>);

/** Borra todas las copias (cierre de sesión). */
export function clearSnapshots(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(DB);
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    } catch { resolve(); }
  });
}

/** Cierre de sesión: borra la copia de datos y las páginas guardadas por el service worker (`luca-pages-*`). */
export async function clearLocalData(): Promise<void> {
  await clearSnapshots();
  try {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("luca-pages")).map((k) => caches.delete(k)));
  } catch { /* sin Cache Storage */ }
}
