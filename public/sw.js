const CACHE_NAME = "splittrip-offline-v6";

const CORE_URLS = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(CORE_URLS.map((url) => cache.add(url)))
      )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (
    event.data &&
    event.data.type === "CACHE_ASSETS" &&
    Array.isArray(event.data.urls)
  ) {
    const urls = event.data.urls.filter((u) => typeof u === "string");
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) =>
        Promise.allSettled(
          urls.map(async (url) => {
            const existing = await cache.match(url);
            if (existing) return;
            const res = await fetch(url);
            if (res && res.ok) {
              await cache.put(url, res);
            }
          })
        )
      )
    );
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Cache-first for immutable Next.js static assets
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Navigation requests: Network-first when online, instant cache fallback in Airplane Mode
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok) {
            cache.put(request, networkResponse.clone());
            if (url.pathname === "/") {
              cache.put("/index.html", networkResponse.clone());
            }
            return networkResponse;
          }
        } catch {
          // Offline — fall through to cache
        }

        const cached =
          (await cache.match(request)) ||
          (await cache.match("/")) ||
          (await cache.match("/index.html"));

        return (
          cached ||
          new Response("Offline", {
            status: 503,
            statusText: "Service Unavailable",
            headers: { "Content-Type": "text/plain" },
          })
        );
      })
    );
    return;
  }

  // Stale-while-revalidate for other same-origin assets
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const networkPromise = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => null);

      if (cached) {
        event.waitUntil(networkPromise);
        return cached;
      }

      const networkResponse = await networkPromise;
      return (
        networkResponse ||
        new Response("", { status: 404, statusText: "Not Found" })
      );
    })
  );
});
