const CACHE_NAME = "qistflow-shell-v3";
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
];

// Install: Immediately take over
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Activate: Delete all previous caches immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => self.clients.claim())
  );
});

// Fetch: NEVER cache dynamic routes or navigation HTML
self.addEventListener("fetch", (event) => {
  // Only cache static icons / fonts, pass everything else direct to network
  const url = new URL(event.request.url);
  if (
    url.pathname.startsWith("/icons/") ||
    url.hostname.includes("fonts.gstatic.com") ||
    url.hostname.includes("fonts.googleapis.com")
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return (
          cached ||
          fetch(event.request).then((response) => {
            if (response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return response;
          })
        );
      })
    );
  }
});
