const CACHE_NAME = "morphe-tracker-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/changelog.html",
  "/assets/style.css",
  "/assets/app.js",
];
const DATA_URLS = ["/data/live.json", "/data/changelog.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

function isDataUrl(url) {
  return DATA_URLS.some((path) => url.pathname.endsWith(path));
}

function isStaticAsset(url) {
  return (
    url.pathname === "/" ||
    url.pathname === "/index.html" ||
    url.pathname === "/changelog.html" ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/data/") ||
    url.origin === "https://fonts.googleapis.com" ||
    url.origin === "https://fonts.gstatic.com"
  );
}

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  if (requestUrl.origin !== location.origin && !requestUrl.href.includes("fonts")) {
    return;
  }

  if (isDataUrl(requestUrl)) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  if (isStaticAsset(requestUrl)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return (
          cached ||
          fetch(event.request).then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            return response;
          })
        );
      })
    );
    return;
  }
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        const clone = response.clone();
        cache.put(request, clone);
      }
      return response;
    })
    .catch(() => cached);

  if (cached) {
    fetchPromise.then((fresh) => {
      if (fresh && fresh.ok && fresh.url === cached.url) {
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: "DATA_UPDATED", url: request.url });
          });
        });
      }
    });
    return cached;
  }

  return fetchPromise;
}
