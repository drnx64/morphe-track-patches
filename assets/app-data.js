function idbSet(key, val) {
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
    return Promise.all([
        fetch("data/core.json?_t=" + Date.now()).then(function(r) { return r.ok ? r.json() : {}; }).catch(function() { return {}; }),
        fetch("data/stats.json?_t=" + Date.now()).then(function(r) { return r.ok ? r.json() : {}; }).catch(function() { return {}; }),
        fetch("data/changes.json?_t=" + Date.now()).then(function(r) { return r.ok ? r.json() : {}; }).catch(function() { return {}; }),
        fetch("data/bundles.json?_t=" + Date.now()).then(function(r) { if (!r.ok) throw new Error("Status " + r.status); return r.json(); }).catch(function() { return {}; })
    ]).then(function(items) {
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
    return fetch("data/state/last_run.json").then(function(r) {
        if (!r.ok) return null;
        return r.json();
    }).then(function(d) {
        return d && d.lastChecked ? d.lastChecked : null;
    }).catch(function() { return null; });
}
