/*
 * Service worker de Luca (ADR-011). Sin librería.
 * - Páginas de /app: red primero; se guardan por ruta (solo las del panel armado) para abrirlas sin conexión. Sin red y sin copia de esa ruta →
 *   /sin-conexion.
 * - /_next/static e íconos: caché primero (archivos con hash, no cambian).
 * - Todo lo demás (auth, server actions, Google, otros orígenes) pasa directo, sin caché.
 * Mensaje "warm": precarga las páginas principales tras una lectura correcta. Al cerrar sesión, la página borra
 * `luca-pages-*` y la IndexedDB (`clearLocalData` en lib/offline-store.ts).
 */
const VERSION = "v2";
const PAGES = `luca-pages-${VERSION}`;
const STATIC = `luca-static-${VERSION}`;
const OFFLINE = "/sin-conexion";
const WARM = ["/app", "/app/movimientos", "/app/ajustes", "/app/conexiones"];
const STATIC_MAX = 250;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll([OFFLINE, "/icon-192.png", "/icon-512.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("luca-") && k !== PAGES && k !== STATIC).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const pageKey = (url) => new URL(url).origin + new URL(url).pathname;

// Solo páginas del panel ya armado (`data-app-shell`): no la pantalla de "sesión caducada" ni redirecciones al login.
async function savePage(req, res) {
  if (!res.ok || res.redirected || res.type !== "basic") return;
  const html = await res.text();
  if (!html.includes("data-app-shell")) return;
  const c = await caches.open(PAGES);
  await c.put(pageKey(req.url), new Response(html, { headers: res.headers }));
  await saveAssets(html);
}

// Los JS/CSS que la página necesita para funcionar (en una página precargada aún no se han descargado).
async function saveAssets(html) {
  const urls = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || [])];
  const c = await caches.open(STATIC);
  await Promise.all(urls.map(async (u) => {
    if (await c.match(u)) return;
    try { const r = await fetch(u); if (r.ok) await c.put(u, r); } catch { /* sin red: se reintenta en la próxima visita */ }
  }));
  await trimStatic();
}

async function trimStatic() {
  const c = await caches.open(STATIC);
  const keys = await c.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - STATIC_MAX)).map((k) => c.delete(k)));
}

async function page(event) {
  try {
    const res = await fetch(event.request);
    event.waitUntil(savePage(event.request, res.clone()));
    return res;
  } catch {
    return (await caches.match(pageKey(event.request.url), { cacheName: PAGES })) || (await caches.match(OFFLINE)) || Response.error();
  }
}

async function asset(event) {
  const hit = await caches.match(event.request, { cacheName: STATIC });
  if (hit) return hit;
  const res = await fetch(event.request);
  if (res.ok) {
    const copy = res.clone();
    event.waitUntil(caches.open(STATIC).then((c) => c.put(event.request, copy)).then(trimStatic));
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate" && (url.pathname === "/app" || url.pathname.startsWith("/app/"))) return event.respondWith(page(event));
  if (url.pathname.startsWith("/_next/static/") || /^\/icon-[\w-]+\.png$/.test(url.pathname)) return event.respondWith(asset(event));
});

self.addEventListener("message", (event) => {
  const type = event.data && event.data.type;
  if (type === "warm") {
    event.waitUntil(Promise.all(WARM.map((p) => fetch(p, { credentials: "same-origin" }).then((res) => savePage(new Request(p), res)).catch(() => {}))));
  }
});
