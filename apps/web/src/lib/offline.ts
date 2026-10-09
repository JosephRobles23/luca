/**
 * Copia local de solo lectura (ADR-011): qué se guarda en el dispositivo y cuándo usarla. Lógica pura, sin React ni
 * IndexedDB (eso vive en `offline-store.ts`).
 */

/** Claves de `Ajustes` que nunca salen de la Sheet hacia el dispositivo. */
export const SECRET_AJUSTES = ["conexiones.iphone.token", "conexiones.execUrl", "conexiones.iphone.execUrl"];

/** Copia de los datos sin secretos (no muta el original). */
export function sanitizeData<T extends { ajustes: Record<string, string> }>(data: T): T {
  const ajustes = { ...data.ajustes };
  SECRET_AJUSTES.forEach((k) => { delete ajustes[k]; });
  return { ...data, ajustes };
}

/** Falla de red: `fetch` lanza `TypeError` sin conexión, o el navegador ya sabe que está desconectado. */
export const isNetworkError = (e: unknown, online: boolean) => e instanceof TypeError || !online;

export type Snapshot<D = unknown, F extends { id: string } = { id: string; name: string }> = {
  email: string;
  file: F;
  data: D;
  savedAt: number;
};

/** La copia sirve si es de la misma cuenta y, si el usuario ya eligió una hoja, de esa hoja. */
export function usableSnapshot<S extends Snapshot<unknown, { id: string }>>(snap: S | null, email: string, fileId: string | null): S | null {
  if (!snap || snap.email !== email) return null;
  if (fileId && snap.file.id !== fileId) return null;
  return snap;
}
