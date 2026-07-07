function idbSet(key, val) {
    logEntry("idbSet", key);
    return new Promise(function(resolve) {
        var req = indexedDB.open('MorpheTrackerCache', 1);
        req.onupgradeneeded = function(e) { e.target.result.createObjectStore('store'); };
        req.onsuccess = function(e) {
            var db = e.target.result;
            var tx = db.transaction('store', 'readwrite');
            tx.objectStore('store').put(val, key);
            tx.oncomplete = function() { db.close(); resolve(); };
            tx.onerror = function() { db.close(); resolve(); };
        };
        req.onerror = function() { resolve(); };
    });
}

function idbGet(key) {
    logEntry("idbGet", key);
    return new Promise(function(resolve) {
        var req = indexedDB.open('MorpheTrackerCache', 1);
        req.onupgradeneeded = function(e) { e.target.result.createObjectStore('store'); };
        req.onsuccess = function(e) {
            var db = e.target.result;
            var tx = db.transaction('store', 'readonly');
            var store = tx.objectStore('store').get(key);
            store.onsuccess = function() { db.close(); resolve(store.result); };
            store.onerror = function() { db.close(); resolve(null); };
        };
        req.onerror = function() { resolve(null); };
    });
}

function fetchAllData() {
    logEntry("fetchAllData");
    return Promise.all([
        fetch("data/core.json?_t=" + Date.now()).then(function(r) { log("fetchAllData", "core.json -> " + r.status); return r.ok ? r.json() : {}; }).catch(function(e) { log("fetchAllData", "core.json error: " + e.message); return {}; }),
        fetch("data/stats.json?_t=" + Date.now()).then(function(r) { log("fetchAllData", "stats.json -> " + r.status); return r.ok ? r.json() : {}; }).catch(function(e) { log("fetchAllData", "stats.json error: " + e.message); return {}; }),
        fetch("data/changes.json?_t=" + Date.now()).then(function(r) { log("fetchAllData", "changes.json -> " + r.status); return r.ok ? r.json() : {}; }).catch(function(e) { log("fetchAllData", "changes.json error: " + e.message); return {}; }),
        fetch("data/bundles.json?_t=" + Date.now()).then(function(r) { log("fetchAllData", "bundles.json -> " + r.status); return r.ok ? r.json() : {}; }).catch(function(e) { log("fetchAllData", "bundles.json error: " + e.message); return {}; })
    ]).then(function(items) {
        log("fetchAllData", "results: date=" + (items[0] && items[0].date) + " bundles=" + Object.keys(items[3] || {}).length);
        return {
            date: (items[0] && items[0].date) || "",
            last_run: (items[0] && items[0].last_run) || "",
            lastChecked: (items[0] && items[0].lastChecked) || "",
            stats: items[1] || {},
            changes: items[2] || {},
            bundles: items[3] || {}
        };
    });
}

function fetchLastChecked() {
    logEntry("fetchLastChecked");
    return fetch("data/state/last_run.json").then(function(r) {
        if (!r.ok) { log("fetchLastChecked", "last_run.json -> " + r.status + " (not ok)"); return null; }
        log("fetchLastChecked", "last_run.json -> " + r.status + " OK");
        return r.json();
    }).then(function(d) {
        var lc = d && d.lastChecked ? d.lastChecked : null;
        log("fetchLastChecked", "lastChecked=" + lc);
        return lc;
    }).catch(function(e) { log("fetchLastChecked", "error: " + e.message); return null; });
}
