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

document.addEventListener("DOMContentLoaded", function() {
    logEntry("DOMContentLoaded");
    log("init", "Checking IndexedDB cache");
    Promise.all([idbGet(CACHE_KEYS.LIVE), idbGet(CACHE_KEYS.ICONS)]).then(function(items) {
        log("init", "Cache found: live=" + !!items[0] + " icons=" + !!items[1]);
        if (!(items[0] && items[1])) {
            log("init", "Cache MISS — showing loading screen");
            showLoadingScreen();
        } else {
            log("init", "Cache HIT — skipping loading screen");
        }
        _initPage();
    });
});

function _initPage() {
    const isDashboard = document.getElementById("nav-dashboard") && document.getElementById("nav-dashboard").classList.contains("active");
    const isChangelog = document.getElementById("nav-changelog") && document.getElementById("nav-changelog").classList.contains("active");

    if (scanTimerInterval) clearInterval(scanTimerInterval);
    updateScanClocks(null);
    scanTimerInterval = setInterval(function() { updateScanClocks(null); }, 1000);

    if (isDashboard) {
        log("init", "Page=Dashboard, userAgent=" + navigator.userAgent);
        initDashboard();
    } else if (isChangelog) {
        log("init", "Page=Changelog, userAgent=" + navigator.userAgent);
        initChangelog();
    } else {
        console.warn("[MorpheTracker] Could not determine page type!");
        hideLoadingScreen();
    }

    const closeBtn = document.getElementById("modal-close-btn");
    if (closeBtn) closeBtn.addEventListener("click", closeAppModal);

    const overlay = document.getElementById("app-detail-modal");
    if (overlay) {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) closeAppModal();
        });
    }

    var bundleCloseBtn = document.getElementById("bundle-modal-close-btn");
    if (bundleCloseBtn) bundleCloseBtn.addEventListener("click", closeBundleModal);

    var bundleOverlay = document.getElementById("bundle-detail-modal");
    if (bundleOverlay) {
        bundleOverlay.addEventListener("click", function(e) {
            if (e.target === bundleOverlay) closeBundleModal();
        });
    }

    var histCloseBtn = document.getElementById("bundle-history-close-btn");
    if (histCloseBtn) histCloseBtn.addEventListener("click", closeBundleHistory);

    var histOverlay = document.getElementById("bundle-history-modal");
    if (histOverlay) {
        histOverlay.addEventListener("click", function(e) {
            if (e.target === histOverlay) closeBundleHistory();
        });
    }

    document.addEventListener("click", function(e) {
        var btn = e.target.closest(".history-btn");
        if (btn) {
            e.stopPropagation();
            var bundle = btn.getAttribute("data-bundle");
            if (bundle) openBundleHistory(bundle);
        }
    });

    var toastCloseBtn = document.getElementById("toast-close-btn");
    if (toastCloseBtn) toastCloseBtn.addEventListener("click", hideToast);

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeAppModal();
            closeBundleModal();
            hideToast();
        }
    });

    const backToTopBtn = document.getElementById("back-to-top-btn");
    if (backToTopBtn) {
        var scrollHandler = function() {
            if (window.scrollY > 300) {
                backToTopBtn.classList.add("visible");
            } else {
                backToTopBtn.classList.remove("visible");
            }
        };
        window.addEventListener("scroll", scrollHandler, { passive: true });
        backToTopBtn.addEventListener("click", function() {
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }
}
