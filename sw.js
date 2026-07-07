self.addEventListener("install", function() {
  self.skipWaiting();
});
self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(names.map(function(name) { return caches.delete(name); }));
    }).then(function() {
      return self.registration.unregister();
    }).then(function() {
      console.log("[MorpheTracker] Old SW unregistered and caches cleared");
    })
  );
});
self.addEventListener("fetch", function(event) {
  event.respondWith(fetch(event.request));
});
