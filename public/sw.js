const CACHE_NAME = "morphe-tracker-v6";
const STATIC_ASSETS = [
  "/",
  "/index.html",
];
const DATA_URLS = ["/data/core.json", "/data/stats.json", "/data/changes.json", "/data/changelog.json"];
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50 MB

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        STATIC_ASSETS.map((url) =>
          fetch(url + "?sw=" + Date.now(), { cache: "no-store" }).then(
            (res) => {
              if (res.ok) cache.put(url, res);
            }
          )
        )
      );
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
  if (DATA_URLS.some((path) => url.pathname.endsWith(path))) return true;
  if (url.pathname.startsWith("/data/bundles/")) return true;
  if (url.pathname.endsWith("/icon_cache.json")) return true;
  if (url.pathname.endsWith("/name_cache.json")) return true;
  if (url.pathname.endsWith("/last_run.json")) return true;
  if (url.pathname.endsWith("/release_cache.json")) return true;
  return false;
}

function isStaticAsset(url) {
  return (
    url.pathname === "/" ||
    url.pathname === "/index.html" ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/data/") ||
    url.pathname === "/feed.xml" ||
    url.pathname === "/sw.js" ||
    url.origin === "https://fonts.googleapis.com" ||
    url.origin === "https://fonts.gstatic.com"
  );
}

async function enforceCacheLimit(cache) {
  const keys = await cache.keys();
  let totalSize = 0;
  const entries = [];
  for (const req of keys) {
    const res = await cache.match(req);
    if (res) {
      const blob = await res.blob();
      totalSize += blob.size;
      entries.push({ req, size: blob.size });
    }
  }
  if (totalSize > MAX_CACHE_SIZE) {
    entries.sort((a, b) => a.size - b.size);
    let freed = 0;
    for (const entry of entries) {
      if (totalSize - freed <= MAX_CACHE_SIZE * 0.8) break;
      await cache.delete(entry.req);
      freed += entry.size;
    }
  }
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
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }
});

self.addEventListener("notificationclick", function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        if (clientList[i].url.indexOf(location.origin) !== -1) {
          return clientList[i].focus();
        }
      }
      return clients.openWindow("/");
    })
  );
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        const body = await response.blob();
        const headers = new Headers(response.headers);
        cache.put(request, new Response(body, {
          status: response.status,
          statusText: response.statusText,
          headers: headers
        }));
        enforceCacheLimit(cache).catch(() => {});
        return new Response(body, {
          status: response.status,
          statusText: response.statusText,
          headers: headers
        });
      }
      return response;
    })
    .catch(() => cached || new Response(null, { status: 502 }));

  if (cached) {
    const cachedForCmp = cached.clone();
    const cachedTextP = cachedForCmp.text().catch(() => null);

    fetchPromise.then(async (fresh) => {
      if (!fresh || !fresh.ok) return;
      try {
        const freshText = await fresh.text();
        const cachedText = await cachedTextP;
        if (cachedText !== null && freshText !== cachedText) {
          self.clients.matchAll().then((clients) => {
            clients.forEach((client) => {
              client.postMessage({ type: "DATA_UPDATED", url: request.url });
            });
          });
          self.registration.showNotification("Morphe Patch Tracker", {
            body: "New patch data available — click to refresh",
            tag: "morphe-data-update",
            renotify: true
          }).catch(function() {});
        }
      } catch(e) {}
    }).catch(function() {});
    return cached;
  }

  return fetchPromise;
}
