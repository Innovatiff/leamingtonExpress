/* Leamington Express — service worker for the three installable apps
 * (website, /admin and /equipo). Pages always come from the network when
 * there is a connection, so every deploy shows up right away; the last copy is
 * kept for when the phone is offline. Built files (/assets/*) never change
 * once published, so they're served from the cache. */

const ASSETS = "lx-assets-v1";
const PAGES = "lx-pages-v1";
const STATIC = "lx-static-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![ASSETS, PAGES, STATIC].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const shellFor = (path) => (path.startsWith("/admin") ? "/admin.html" : path.startsWith("/equipo") ? "/equipo.html" : "/index.html");

const OFFLINE_PAGE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sin conexión · Offline</title><body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px">
<div><h1 style="font-size:1.4rem">Sin conexión a internet</h1><p>Revisa tu conexión e inténtalo de nuevo.<br>You're offline — check your connection and try again.</p>
<button onclick="location.reload()" style="font:inherit;padding:12px 20px;border-radius:999px;border:0;background:#1f4fe6;color:#fff">Reintentar · Retry</button></div></body>`;

async function networkFirstPage(request) {
  const url = new URL(request.url);
  const key = shellFor(url.pathname);
  try {
    const response = await fetch(request);
    if (response.ok) {
      const copy = response.clone();
      caches.open(PAGES).then((cache) => cache.put(key, copy));
    }
    return response;
  } catch {
    const cached = await caches.match(key, { cacheName: PAGES });
    return cached || new Response(OFFLINE_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { cacheName: ASSETS });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const copy = response.clone();
    caches.open(ASSETS).then(async (cache) => {
      await cache.put(request, copy);
      // files from older versions pile up after each update: keep the newest 250
      const keys = await cache.keys();
      await Promise.all(keys.slice(0, Math.max(0, keys.length - 250)).map((k) => cache.delete(k)));
    });
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC);
  const cached = await cache.match(request);
  const fresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || fresh;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Firebase, images, Stripe… go straight to the network
  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (/\.(png|svg|webp|jpg|webmanifest|woff2)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

// Tapping a notification opens (or focuses) the right app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((w) => new URL(w.url).pathname.startsWith(target.split("?")[0]));
      if (existing) return existing.focus();
      return self.clients.openWindow(target);
    }),
  );
});
