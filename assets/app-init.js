(function() {
    try {
        if (localStorage.getItem("morphe_storage_cleared")) return;
    } catch(e) { return; }

    try { localStorage.clear(); } catch(e) {}
    try { sessionStorage.clear(); } catch(e) {}

    try {
        if (indexedDB.databases) {
            indexedDB.databases().then(function(dbs) {
                dbs.forEach(function(db) {
                    if (db.name) indexedDB.deleteDatabase(db.name);
                });
            }, function() {});
        }
    } catch(e) {}

    if (caches && caches.keys) {
        caches.keys().then(function(names) {
            names.forEach(function(name) { caches.delete(name); });
        });
    }

    try { localStorage.setItem("morphe_storage_cleared", "1"); } catch(e) {}
    location.reload();
})();
