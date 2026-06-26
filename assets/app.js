// One-time storage clear after deploy (clears stale caches/localStorage/IndexedDB)
(function() {
    if (localStorage.getItem("morphe_storage_cleared")) return;

    // Clear everything before the app boots
    localStorage.clear();
    sessionStorage.clear();

    // Clear all IndexedDB databases
    if (indexedDB.databases) {
        indexedDB.databases().then(function(dbs) {
            dbs.forEach(function(db) {
                if (db.name) indexedDB.deleteDatabase(db.name);
            });
        });
    }

    // Clear all Cache Storage (SW caches)
    if (caches && caches.keys) {
        caches.keys().then(function(names) {
            names.forEach(function(name) { caches.delete(name); });
        });
    }

    localStorage.setItem("morphe_storage_cleared", "1");
    location.reload();
})();

// Dynamic UI engine
document.addEventListener("DOMContentLoaded", () => {
    const isDashboard = document.getElementById("nav-dashboard") && document.getElementById("nav-dashboard").classList.contains("active");
    const isChangelog = document.getElementById("nav-changelog") && document.getElementById("nav-changelog").classList.contains("active");

    if (isDashboard) {
        initDashboard();
    } else if (isChangelog) {
        initChangelog();
    } else {
        console.warn("[MorpheTracker] Could not determine page type!");
    }
});

// Ordinal suffix for scan batch tooltips
function ordinalSuffix(n) {
    var s = ['th', 'st', 'nd', 'rd'];
    var v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
}

// Format timestamp cleanly
function formatTime(isoStr) {
    if (!isoStr) return "-";
    try {
        const d = new Date(isoStr);
        const date = new Intl.DateTimeFormat("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric"
        }).format(d);
        const time = new Intl.DateTimeFormat("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true
        }).format(d);
        return `${date} at ${time}`;
    } catch(e) {
        return isoStr;
    }
}

// Convert YYYY-MM-DD to "Month Day, Year"
function formatFriendlyDate(dateStr) {
    if (!dateStr) return "-";
    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const year = parts[0];
        const monthIndex = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        if (monthIndex >= 0 && monthIndex < 12) {
            return `${months[monthIndex]} ${day}, ${year}`;
        }
    }
    return dateStr;
}

// Extract GitHub/GitLab profile author link from repository URL
function getAuthorLink(repoUrl) {
    if (!repoUrl) return "unknown";
    const gitlabMatch = repoUrl.match(/https:\/\/gitlab\.com\/([^/]+)/);
    if (gitlabMatch) {
        const author = gitlabMatch[1];
        return `<a href="https://gitlab.com/${author}" target="_blank" class="author-link">@${author}</a>`;
    }
    const match = repoUrl.match(/https:\/\/github\.com\/([^/]+)/);
    if (match) {
        const author = match[1];
        return `<a href="https://github.com/${author}" target="_blank" class="author-link">@${author}</a>`;
    }
    return "unknown";
}

// Check if an app is pre-release (in dev but not in stable for a bundle)
function isAppPreRelease(bundleName, pkgName, bundlesData) {
    if (!bundlesData) return false;
    const stableKey = `${bundleName}:stable`;
    const devKey = `${bundleName}:dev`;

    const inStable = bundlesData[stableKey] && bundlesData[stableKey].apps &&
                     bundlesData[stableKey].apps.some(a => a.package === pkgName);
    const inDev = bundlesData[devKey] && bundlesData[devKey].apps &&
                  bundlesData[devKey].apps.some(a => a.package === pkgName);

    return inDev && !inStable;
}

const APP_VERSION = "3";
const APP_VERSION_KEY = "morphe_app_version";

const storedAppVersion = localStorage.getItem(APP_VERSION_KEY);
if (storedAppVersion !== APP_VERSION) {
  sessionStorage.removeItem("morphe_checked");
  localStorage.removeItem("morphe_last_run");
  localStorage.removeItem("morphe_versions");
  localStorage.setItem(APP_VERSION_KEY, APP_VERSION);
}

let allBundlesData = {};
let iconCache = {};
let nameCache = {};
let currentFilters = {
    search: "",
    channel: "all"
};
let cachedLastRun = "";

function resolveAppName(app) {
    var n = nameCache[app.package];
    if (typeof n === "string" && n) return n;
    return app.app_name;
}

// ── IndexedDB Cache ──────────────────────────────────────────────────────────
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

function initDashboard() {
    const checkingEl = document.getElementById("checking-message");
    const skelUpdates = document.getElementById("skeleton-updates");
    const skelGrid = document.getElementById("skeleton-grid");

    applyFiltersFromUrl();

    // Load cached data instantly from IndexedDB
    Promise.all([idbGet('live'), idbGet('icons'), idbGet('names')]).then(function(items) {
        if (items[0] && items[1]) {
            cachedLastRun = items[0].last_run || items[0].lastChecked || "";
            if (checkingEl) checkingEl.style.display = "none";
            if (skelUpdates) skelUpdates.style.display = "none";
            if (skelGrid) skelGrid.style.display = "none";
            iconCache = items[1];
            if (items[2]) nameCache = items[2];
            renderStats(items[0]);
            allBundlesData = {};
            for (const [key, b] of Object.entries(items[0].bundles || {})) {
                allBundlesData[key] = { ...b, key: key };
            }
            renderTodayUpdates(items[0]);
            setupDashboardFilters();
            filterAndRenderBundles();
            scrollToHighlightedBundle();
        }
    }).catch(function() {});

    // Background check for fresh data
    const isSessionChecked = sessionStorage.getItem("morphe_checked");
    if (isSessionChecked) {
        fetchAndRenderDashboard();
    } else {
        if (checkingEl) checkingEl.style.display = "block";
        if (skelUpdates) skelUpdates.style.display = "none";
        if (checkingEl) checkingEl.textContent = "Checking for updates...";
        runCheckPhase();
    }
}

function runCheckPhase() {
    const checkingEl = document.getElementById("checking-message");

    fetch("data/live.json?_t=" + Date.now())
        .then(r => { if (!r.ok) throw new Error("Status " + r.status); return r.json(); })
        .then(data => {
            const lastRun = data.last_run || data.lastChecked || "";
            const storedRun = localStorage.getItem("morphe_last_run") || "";

            if (lastRun && lastRun !== storedRun) {
                if (checkingEl) checkingEl.textContent = "New updates found!";
                localStorage.setItem("morphe_last_run", lastRun);
                localStorage.setItem("morphe_versions", JSON.stringify(getBundleVersions(data)));
            } else {
                if (checkingEl) checkingEl.textContent = "Up to date";
            }

            sessionStorage.setItem("morphe_checked", "1");

            Promise.all([
                fetch("data/state/icon_cache.json").then(r => r.ok ? r.json() : {}).catch(() => ({})),
                fetch("data/state/name_cache.json").then(r => r.ok ? r.json() : {}).catch(() => ({}))
            ]).then(function(items) {
                setTimeout(function() {
                    finalizeDashboard(data, items[0], items[1]);
                }, 600);
            });
        })
        .catch(() => {
            sessionStorage.setItem("morphe_checked", "1");
            fetchAndRenderDashboard();
        });
}

function getBundleVersions(data) {
    const versions = {};
    for (const [key, b] of Object.entries(data.bundles || {})) {
        const name = b.bundle || key.split(":")[0];
        if (b.version) {
            versions[name] = b.version;
        }
    }
    return versions;
}

function fetchAndRenderDashboard() {
    Promise.all([
        fetch("data/live.json").then(r => { if (!r.ok) throw new Error("Status " + r.status); return r.json(); }),
        fetch("data/state/icon_cache.json").then(r => r.ok ? r.json() : {}).catch(() => ({})),
        fetch("data/state/name_cache.json").then(r => r.ok ? r.json() : {}).catch(() => ({}))
    ])
        .then(([data, cache, names]) => finalizeDashboard(data, cache, names))
        .catch(err => {
            console.error("[MorpheTracker] ERROR loading live.json:", err);
            const container = document.getElementById("bundles-grid-container");
            if (container) {
                container.innerHTML = `<div class="error-state">Failed to load dashboard data: ${err.message}. Ensure data/live.json exists.</div>`;
            }
        });
}

function finalizeDashboard(data, cache, names) {
    var newRun = data.last_run || data.lastChecked || "";
    if (newRun && newRun === cachedLastRun && Object.keys(allBundlesData).length > 0) {
        return;
    }
    cachedLastRun = newRun;

    iconCache = cache || {};
    if (names) nameCache = names;

    applyFiltersFromUrl();

    const checkingEl = document.getElementById("checking-message");
    const skelUpdates = document.getElementById("skeleton-updates");
    const skelGrid = document.getElementById("skeleton-grid");
    if (checkingEl) checkingEl.style.display = "none";
    if (skelUpdates) skelUpdates.style.display = "none";
    if (skelGrid) skelGrid.style.display = "none";

    renderStats(data);

    allBundlesData = {};
    for (const [key, b] of Object.entries(data.bundles || {})) {
        allBundlesData[key] = { ...b, key: key };
    }

    renderTodayUpdates(data);
    setupDashboardFilters();
    filterAndRenderBundles();
    scrollToHighlightedBundle();

    idbSet('live', data);
    idbSet('icons', iconCache);
    idbSet('names', nameCache);
}

// Re-run highlight on same-page hash changes (e.g. clicking bundle links in Today's Updates)
window.addEventListener("hashchange", scrollToHighlightedBundle);

// Scroll to and highlight a bundle card based on URL hash: #bundle=<name>
function scrollToHighlightedBundle() {
    const hash = window.location.hash;
    if (!hash.startsWith("#bundle=")) return;

    const targetBundleName = decodeURIComponent(hash.slice("#bundle=".length));
    if (!targetBundleName) return;

    // Give DOM a tick to paint before scrolling
    requestAnimationFrame(() => {
        const allCards = document.querySelectorAll(".bundle-card");
        for (const card of allCards) {
            const nameEl = card.querySelector(".bundle-name-title");
            if (nameEl && nameEl.textContent.trim() === targetBundleName) {
                card.scrollIntoView({ behavior: "smooth", block: "center" });
                card.classList.add("expanded");
                card.classList.add("highlighted");
                card.addEventListener("animationend", () => {
                    card.classList.remove("highlighted");
                }, { once: true });
                break;
            }
        }
    });
}

function renderStats(data) {
    document.getElementById("stat-total-bundles").textContent = data.stats?.total_bundles ?? 0;
    document.getElementById("stat-total-apps").textContent = data.stats?.total_apps ?? 0;
    document.getElementById("stat-new-apps-today").textContent = data.stats?.new_apps_today ?? 0;
    document.getElementById("stat-new-bundles-today").textContent = data.stats?.new_bundles_today ?? 0;
    document.getElementById("val-last-checked").textContent = formatTime(data.lastChecked || data.last_run);
}

function renderTodayUpdates(data) {
    const updatesLabel = document.getElementById("updates-date-label");
    const container = document.getElementById("today-updates-container");
    if (!container) return;

    updatesLabel.textContent = `Updated: ${formatFriendlyDate(data.date)}`;

    const changes = data.changes || {};
    const affectedBundles = changes.affected_bundles || [];

    if (affectedBundles.length === 0) {
        container.innerHTML = `<div class="no-updates-msg">No compatibility changes detected in the latest update scan. All active patches match the current catalog.</div>`;
        return;
    }

    container.innerHTML = "";

    const grouped = groupAffectedBundles(affectedBundles);

    const sortedBundleNames = Object.keys(grouped).sort((a, b) => {
        const aIsNew = grouped[a].badge_type === "NEW BUNDLE";
        const bIsNew = grouped[b].badge_type === "NEW BUNDLE";
        if (aIsNew && !bIsNew) return -1;
        if (!aIsNew && bIsNew) return 1;
        const aHasNewApps = grouped[a].apps.some(app => app.badge_type === "NEW APP");
        const bHasNewApps = grouped[b].apps.some(app => app.badge_type === "NEW APP");
        if (aHasNewApps && !bHasNewApps) return -1;
        if (!aHasNewApps && bHasNewApps) return 1;
        return a.localeCompare(b);
    });

    sortedBundleNames.forEach(bName => {
        const bGroup = grouped[bName];
        const isNewBundle = bGroup.badge_type === "NEW BUNDLE";

        const bundleRow = document.createElement("div");
        bundleRow.className = "update-row";

        if (isNewBundle) {
            let repoUrl = "";
            const bKeyStable = `${bName}:stable`;
            const bKeyDev = `${bName}:dev`;

            if (data.bundles && data.bundles[bKeyStable]) {
                repoUrl = data.bundles[bKeyStable].repo_url;
            } else if (data.bundles && data.bundles[bKeyDev]) {
                repoUrl = data.bundles[bKeyDev].repo_url;
            } else {
                repoUrl = `https://github.com/${bName}/revanced-patches`;
            }

            const authorHtml = getAuthorLink(repoUrl);
            const channelsStr = bGroup.channels.join(", ");

            bundleRow.innerHTML = `
                <span class="badge badge-new-bundle">NEW BUNDLE</span>
                <span>Bundle <a href="#bundle=${encodeURIComponent(bName)}" class="changelog-bundle-link"><strong>${bName} patches</strong></a> (${channelsStr}) added by ${authorHtml}</span>
            `;
        } else {
            bundleRow.innerHTML = `
                <span class="badge badge-updated-bundle">UPDATED</span>
                <span><a href="#bundle=${encodeURIComponent(bName)}" class="changelog-bundle-link"><strong>${bName} patches</strong></a></span>
            `;
        }

        // Click bundle link -> open bundle modal (also update hash for bookmarking)
        const bundleLink = bundleRow.querySelector(".changelog-bundle-link");
        if (bundleLink) {
            bundleLink.addEventListener("click", function(e) {
                e.preventDefault();
                window.location.hash = "bundle=" + encodeURIComponent(bName);
                openBundleModal(bName, {
                    version: bGroup.version || "",
                    channels: bGroup.channels
                });
            });
        }

        if (bGroup.apps.length > 0) {
            const appsContainer = document.createElement("div");
            appsContainer.className = "update-bundle-apps";

            const appBadgeMap = {
                "NEW APP": '<span class="badge badge-new">NEW APP</span>',
                "UPDATED APP": '<span class="badge badge-updated">UPDATED APP</span>',
                "REMOVED APP": '<span class="badge badge-removed">REMOVED APP</span>'
            };

            // Sort: NEW APP first, then UPDATED APP, then REMOVED APP
            const sortOrder = {"NEW APP": 0, "UPDATED APP": 1, "REMOVED APP": 2};
            bGroup.apps.sort(function(a, b) {
                return (sortOrder[a.badge_type] ?? 1) - (sortOrder[b.badge_type] ?? 1);
            });

            bGroup.apps.forEach(function(app) {
                var badgeHtml = appBadgeMap[app.badge_type] || appBadgeMap["NEW APP"];
                var isPre = isAppPreRelease(bName, app.package, data.bundles);
                var preReleaseBadge = isPre ? '<span class="badge badge-pre-release">PRE-RELEASE</span>' : '';
                var iconUrl = getAppIconUrl(app);
                var appIconHtml3 = iconUrl ? '<a href="https://play.google.com/store/apps/details?id=' + encodeURIComponent(app.package) + '" target="_blank" class="app-icon-link">' + getAppIconHtml(iconUrl) + '</a>' : '';
                var scanBadges = (app.scan_numbers || []).map(function(sn) {
                    return '<span class="badge badge-scan" title="' + sn + ordinalSuffix(sn) + ' scan batch">' + sn + '</span>';
                }).join(' ');

                var appRow = document.createElement("div");
                appRow.className = "update-row";
                appRow.innerHTML = [
                    badgeHtml,
                    preReleaseBadge,
                    appIconHtml3,
                    '<span><strong class="changelog-app-link">' + escHtml(resolveAppName(app)) + '</strong> ' + scanBadges + '</span>'
                ].join(' ');

                var linkEl = appRow.querySelector(".changelog-app-link");
                if (linkEl) {
                    linkEl.addEventListener("click", function(e) {
                        e.stopPropagation();
                        var pkg = app.package;
                        var bundleName = bName;
                        var channels = bGroup.channels;
                        var stableKey = bundleName + ":stable";
                        var devKey = bundleName + ":dev";
                        var appData = null;
                        if (allBundlesData[stableKey]) {
                            appData = allBundlesData[stableKey].apps.find(function(a) { return a.package === pkg; });
                        }
                        if (!appData && allBundlesData[devKey]) {
                            appData = allBundlesData[devKey].apps.find(function(a) { return a.package === pkg; });
                        }
                        if (appData) {
                            openAppModal(appData, { bundle: bundleName, channels: channels, patch_diff: app.patch_diff });
                        }
                    });
                }

                appsContainer.appendChild(appRow);
            });

            const groupDiv = document.createElement("div");
            groupDiv.className = "update-bundle-group";
            groupDiv.appendChild(bundleRow);
            groupDiv.appendChild(appsContainer);
            container.appendChild(groupDiv);
        } else {
            const groupDiv = document.createElement("div");
            groupDiv.className = "update-bundle-group";
            groupDiv.appendChild(bundleRow);
            container.appendChild(groupDiv);
        }
    });
}

// Extract repository path (owner/repo) and platform from repository URL
function getRepoInfo(repoUrl) {
    if (!repoUrl) return { isGitLab: false, path: "" };
    const isGitLab = repoUrl.includes("gitlab.com");
    const match = repoUrl.match(/https:\/\/(?:github|gitlab)\.com\/([^/]+\/[^/]+)/);
    const path = match ? match[1].replace(/\.git$/, "") : "";
    return { isGitLab, path };
}

function syncFilterToUrl() {
    var params = new URLSearchParams();
    if (currentFilters.search) params.set("search", currentFilters.search);
    if (currentFilters.channel && currentFilters.channel !== "all") params.set("channel", currentFilters.channel);
    var newUrl = params.toString() ? "?" + params.toString() : window.location.pathname;
    history.replaceState(null, "", newUrl);
}

function applyFiltersFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var search = params.get("search") || "";
    var channel = params.get("channel") || "all";
    currentFilters.search = search.toLowerCase().trim();
    currentFilters.channel = channel;
    var searchInput = document.getElementById("search-input");
    if (searchInput) searchInput.value = search;
    var filterButtons = document.querySelectorAll(".filter-group .filter-btn");
    filterButtons.forEach(function(btn) {
        btn.classList.toggle("active", btn.getAttribute("data-channel") === channel);
    });
}

function setupDashboardFilters() {
    const searchInput = document.getElementById("search-input");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            currentFilters.search = e.target.value.toLowerCase().trim();
            syncFilterToUrl();
            filterAndRenderBundles();
        });
    }

    const filterButtons = document.querySelectorAll(".filter-group .filter-btn");
    filterButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            filterButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentFilters.channel = btn.getAttribute("data-channel");
            syncFilterToUrl();
            filterAndRenderBundles();
        });
    });
}

function filterAndRenderBundles() {
    const container = document.getElementById("bundles-grid-container");
    if (!container) return;

    // Group all bundles by bundle name, merging channels and deduplicating apps
    const grouped = {};
    Object.values(allBundlesData).forEach(b => {
        if (currentFilters.channel !== "all" && b.channel !== currentFilters.channel) {
            return;
        }

        const name = b.bundle;
        if (!grouped[name]) {
            grouped[name] = {
                bundle: name,
                channels: [b.channel],
                repo_url: b.repo_url,
                created_at: b.created_at,
                version: b.version || "",
                apps: [...(b.apps || [])]
            };
        } else {
            if (b.version && !grouped[name].version) {
                grouped[name].version = b.version;
            }
            if (!grouped[name].channels.includes(b.channel)) {
                grouped[name].channels.push(b.channel);
            }
            const existingPkgs = new Set(grouped[name].apps.map(a => a.package));
            if (b.apps) {
                b.apps.forEach(a => {
                    if (!existingPkgs.has(a.package)) {
                        grouped[name].apps.push(a);
                        existingPkgs.add(a.package);
                    }
                });
            }
        }
    });

    let list = Object.values(grouped);

    // Apply search filter
    if (currentFilters.search) {
        const query = currentFilters.search;
        list = list.filter(b => {
            const matchBundle = b.bundle.toLowerCase().includes(query);
            const matchApp = b.apps && b.apps.some(app =>
                resolveAppName(app).toLowerCase().includes(query) ||
                app.package.toLowerCase().includes(query)
            );
            return matchBundle || matchApp;
        });
    }

    // Sort: priority list first, then by app count descending, then alphabetical
    list.sort((a, b) => {
        const orderList = ["morphe", "piko", "rookieenough", "hoo-dles", "paresh-maheshwari", "brosssh", "patcheddit"];
        const aIndex = orderList.indexOf(a.bundle);
        const bIndex = orderList.indexOf(b.bundle);

        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;

        const aCount = a.apps ? a.apps.length : 0;
        const bCount = b.apps ? b.apps.length : 0;
        if (bCount !== aCount) return bCount - aCount;
        return a.bundle.localeCompare(b.bundle);
    });

    if (list.length === 0) {
        container.innerHTML = '<div class="loading-state">No matching Morphe bundles found.</div>';
        return;
    }

    container.innerHTML = "";
    list.forEach(b => {
        const card = buildBundleCard(b);
        container.appendChild(card);
    });
}

// Safely escape HTML special characters
function escHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Group affected bundles by base name, merge channels, deduplicate apps with status precedence
function groupAffectedBundles(affectedBundles) {
    const appPrecedence = {"NEW APP": 0, "UPDATED APP": 1, "REMOVED APP": 2};
    const grouped = {};

    affectedBundles.forEach(function(b) {
        const bName = b.bundle;
        if (!grouped[bName]) {
            grouped[bName] = {
                bundle: bName,
                channels: [],
                apps: [],
                badge_type: b.badge_type
            };
        }
        if (!grouped[bName].channels.includes(b.channel)) {
            grouped[bName].channels.push(b.channel);
        }
        (b.apps || []).forEach(function(app) {
            const existing = grouped[bName].apps.find(function(a) { return a.package === app.package; });
            if (!existing) {
                const merged = {...app};
                merged.scan_numbers = app.scan_numbers ? [...app.scan_numbers] : [];
                grouped[bName].apps.push(merged);
            } else {
                if (appPrecedence[app.badge_type] < appPrecedence[existing.badge_type]) {
                    existing.badge_type = app.badge_type;
                }
                if (app.scan_numbers) {
                    app.scan_numbers.forEach(function(sn) {
                        if (!existing.scan_numbers) existing.scan_numbers = [];
                        if (existing.scan_numbers.indexOf(sn) === -1) {
                            existing.scan_numbers.push(sn);
                        }
                    });
                }
            }
        });
        if (b.badge_type === "NEW BUNDLE") {
            grouped[bName].badge_type = "NEW BUNDLE";
        }
    });

    return grouped;
}

// Resolve icon URL from the app object, falling back to the icon cache
function getAppIconUrl(app) {
    if (!app) return "";
    const url = app.icon_url || iconCache[app.package] || "";
    if (typeof url === "string") return url;
    return "";
}

// Generate an app icon <img> tag from a pre-fetched icon URL
function getAppIconHtml(iconUrl, sizeClass) {
    if (!iconUrl) return "";
    sizeClass = sizeClass || "app-icon";
    return '<img class="' + sizeClass + '" src="' + iconUrl + '" alt="" loading="lazy" onerror="this.remove()">';
}

const githubSvg = '<svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>';

const gitlabSvg = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M23.957 12.355l-2.316-7.13a.9.9 0 0 0-.309-.434.908.908 0 0 0-.534-.143.91.91 0 0 0-.528.163.906.906 0 0 0-.294.417L17.7 12.355H6.3L4.024 5.228a.9.9 0 0 0-.295-.417.913.913 0 0 0-.53-.163.906.906 0 0 0-.533.143.904.904 0 0 0-.308.434l-2.316 7.13a.593.593 0 0 0 .218.675l10.963 7.97a1.32 1.32 0 0 0 1.554 0l10.963-7.97a.593.593 0 0 0 .218-.675z"/></svg>';

// Build a single bundle card element
function buildBundleCard(bundle) {
    const card = document.createElement("div");
    card.className = "bundle-card";
    card.dataset.bundleName = bundle.bundle;

    const apps = [...(bundle.apps || [])];
    apps.sort((x, y) => resolveAppName(x).localeCompare(resolveAppName(y)));
    const count = apps.length;
    const appsWord = count === 1 ? "app" : "apps";

    const repoInfo = getRepoInfo(bundle.repo_url);
    const param = repoInfo.isGitLab ? "gitlab" : "github";
    const addMorpheUrl = "https://morphe.software/add-source?" + param + "=" + encodeURIComponent(repoInfo.path);
    const iconSvg = repoInfo.isGitLab ? gitlabSvg : githubSvg;

    let badgesHtml = "";
    bundle.channels.forEach(ch => {
        badgesHtml += '<span class="channel-badge ' + ch + '">' + ch + '</span>';
    });

    let updatedBadge = "";
    if (bundle.version) {
        const storedVersions = JSON.parse(localStorage.getItem("morphe_versions") || "{}");
        const prevVersion = storedVersions[bundle.bundle];
        if (prevVersion && prevVersion !== bundle.version) {
            updatedBadge = '<span class="bundle-updated-badge">Updated</span>';
        }
    }

    const versionTag = bundle.version
        ? '<span class="bundle-version-tag">' + escHtml(bundle.version) + '</span>'
        : "";

    card.innerHTML = [
        '<div class="bundle-card-header">',
        '  <div class="bundle-title-group">',
        '    <div class="bundle-title-row">',
        '      <span class="bundle-name-title" title="' + escHtml(bundle.bundle) + '">' + escHtml(bundle.bundle) + '</span>' + updatedBadge,
        '    </div>',
        '    <div class="channel-badges-group">' + badgesHtml + '</div>',
        '    ' + versionTag,
        '  </div>',
        '  <a href="' + escHtml(bundle.repo_url) + '" class="github-repo-icon-link" target="_blank" title="View Source Repository" onclick="event.stopPropagation()">' + iconSvg + '</a>',
        '</div>',
        '<div class="apps-summary">' + count + ' compatible ' + appsWord + '</div>',
        '<div class="apps-card-drawer" data-drawer></div>',
        '<a href="' + escHtml(addMorpheUrl) + '" class="add-morphe-btn" target="_blank" onclick="event.stopPropagation()">Add to Morphe</a>'
    ].join('');

    // Build drawer eagerly so the first expand is instant
    buildAppCardsDrawer(card, bundle, apps);

    card.addEventListener("click", function(e) {
        card.classList.toggle("expanded");
        if (bundle.version) {
            const storedVersions = JSON.parse(localStorage.getItem("morphe_versions") || "{}");
            if (storedVersions[bundle.bundle] !== bundle.version) {
                storedVersions[bundle.bundle] = bundle.version;
                localStorage.setItem("morphe_versions", JSON.stringify(storedVersions));
            }
        }
    });
    return card;
}

// Build the app-cards drawer inside a bundle card (called lazily on first expand)
function buildAppCardsDrawer(card, bundle, apps) {
    const drawer = card.querySelector("[data-drawer]");
    if (!drawer) return;

    if (apps.length === 0) {
        drawer.innerHTML = '<div class="no-apps-msg">No app info available.</div>';
        return;
    }

    const fragment = document.createDocumentFragment();

    apps.forEach(app => {
        const isPre = isAppPreRelease(bundle.bundle, app.package, allBundlesData);

        const patchList = app.patches || [];
        const patchCount = patchList.length;

        // Collect all compatible versions for this app
        const allVersions = new Set();
        patchList.forEach(p => {
            if (p.compatible_versions && p.compatible_versions.length > 0) {
                p.compatible_versions.forEach(v => allVersions.add(v));
            }
        });
        const versionArr = [...allVersions].sort();

        const appCard = document.createElement("div");
        appCard.className = "app-mini-card";
        appCard.setAttribute("role", "button");
        appCard.setAttribute("tabindex", "0");
        appCard.setAttribute("aria-label", "View patches for " + resolveAppName(app));

        let versionsPreview = "";
        if (versionArr.length === 0) {
            versionsPreview = '<span class="version-chip any">Any version</span>';
        } else {
            versionsPreview = versionArr.slice(0, 3).map(v =>
                '<span class="version-chip">' + escHtml(v) + '</span>'
            ).join('');
            if (versionArr.length > 3) {
                versionsPreview += '<span class="version-chip any">+' + (versionArr.length - 3) + '</span>';
            }
        }

        const preBadge = isPre
            ? '<span class="badge badge-pre-release">Pre-Release</span>'
            : '';

        const appIconHtml2 = getAppIconHtml(getAppIconUrl(app));

        appCard.innerHTML = [
            '<div class="app-mini-card-main">',
            appIconHtml2,
            '  <div class="app-mini-card-info">',
            '    <span class="app-mini-name">' + escHtml(resolveAppName(app)) + '</span>',
            '    ' + preBadge,
            '    <span class="app-mini-pkg">' + escHtml(app.package) + '</span>',
            '  </div>',
            '  <div class="app-mini-stats">',
            '    <span class="app-mini-patch-count">' + patchCount + ' patch' + (patchCount !== 1 ? 'es' : '') + '</span>',
            '    <svg class="app-mini-arrow" viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L10 8 6.22 4.28a.75.75 0 0 1 0-1.06z"/></svg>',
            '  </div>',
            '</div>',
            '<div class="app-mini-versions">' + versionsPreview + '</div>'
        ].join('');

        // Click app card → open modal
        appCard.addEventListener("click", (e) => {
            e.stopPropagation();
            openAppModal(app, bundle);
        });

        // Keyboard accessibility
        appCard.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                openAppModal(app, bundle);
            }
        });

        fragment.appendChild(appCard);
    });

    drawer.appendChild(fragment);
}

// ── Modal ─────────────────────────────────────────────────────────────────────

let modalState = {};
let _bundleWasOpen = false;

function openAppModal(app, bundle) {
    const modal = document.getElementById("app-detail-modal");
    if (!modal) return;

    // Hide bundle modal if open (don't close — restore later)
    _bundleWasOpen = false;
    var bundleModal = document.getElementById("bundle-detail-modal");
    if (bundleModal && bundleModal.classList.contains("open")) {
        _bundleWasOpen = true;
        bundleModal.classList.remove("open");
    }

    // Populate header
    const modalIconHtml = getAppIconHtml(getAppIconUrl(app), "app-icon app-icon-modal");
    document.getElementById("modal-app-name").innerHTML = modalIconHtml + escHtml(resolveAppName(app));

    const pkgLink = document.getElementById("modal-pkg-link");
    pkgLink.textContent = app.package;
    pkgLink.href = "https://play.google.com/store/apps/details?id=" + encodeURIComponent(app.package);

    const playBtn = document.getElementById("modal-play-btn");
    playBtn.href = "https://play.google.com/store/apps/details?id=" + encodeURIComponent(app.package);

    document.getElementById("modal-bundle-info").textContent = "in " + bundle.bundle;

    // Channel badges
    const channelRow = document.getElementById("modal-channel-row");
    channelRow.innerHTML = bundle.channels.map(ch =>
        '<span class="channel-badge ' + ch + '">' + ch + '</span>'
    ).join('');

    // Store modal state for channel toggling
    const stableBundleData = allBundlesData[`${bundle.bundle}:stable`];
    const devBundleData    = allBundlesData[`${bundle.bundle}:dev`];

    const stableAppData = stableBundleData?.apps?.find(a => a.package === app.package);
    const devAppData    = devBundleData?.apps?.find(a => a.package === app.package);

    modalState = {
        stableApp: stableAppData || null,
        devApp: devAppData || null,
        bundleName: bundle.bundle,
        currentChannel: "stable",
        patchDiff: bundle.patch_diff || null
    };

    // Show/hide toggle buttons based on available channels
    var stableBtn = document.querySelector('.channel-toggle-btn[data-channel="stable"]');
    var devBtn = document.querySelector('.channel-toggle-btn[data-channel="dev"]');
    if (stableBtn) stableBtn.style.display = stableAppData ? "" : "none";
    if (devBtn) devBtn.style.display = devAppData ? "" : "none";

    // Determine default channel
    var defaultChannel = "stable";
    if (!stableAppData && devAppData) defaultChannel = "dev";

    // Wire up toggle buttons
    var toggleBtns = document.querySelectorAll(".channel-toggle-btn");
    toggleBtns.forEach(function(btn) {
        btn.onclick = null;
        btn.addEventListener("click", function() {
            var channel = this.getAttribute("data-channel");
            toggleBtns.forEach(function(b) { b.classList.remove("active"); });
            this.classList.add("active");
            modalState.currentChannel = channel;
            renderModalChannel();
        });
    });

    // Default to the available channel
    toggleBtns.forEach(function(b) { b.classList.remove("active"); });
    var activeBtn = document.querySelector('.channel-toggle-btn[data-channel="' + defaultChannel + '"]');
    if (activeBtn) activeBtn.classList.add("active");
    modalState.currentChannel = defaultChannel;
    renderModalChannel();

    // Show modal
    modal.classList.add("open");
    document.body.style.overflow = "hidden";

    // Focus the close button for accessibility
    const closeBtn = document.getElementById("modal-close-btn");
    if (closeBtn) closeBtn.focus();
}

function renderModalChannel() {
    const channel = modalState.currentChannel;
    const stableApp = modalState.stableApp;
    const devApp = modalState.devApp;

    const stablePatches = stableApp?.patches || [];
    const devPatches = devApp?.patches || [];
    const stablePatchNames = new Set(stablePatches.map(p => p.name));

    let showPatches, versionSource;

    if (channel === "stable") {
        showPatches = [...stablePatches];
        versionSource = stableApp;
    } else {
        const merged = [
            ...stablePatches,
            ...devPatches
                .filter(p => !stablePatchNames.has(p.name))
                .map(p => ({ ...p, isDevOnly: true, isNew: true }))
        ];
        showPatches = merged;
        versionSource = devApp || stableApp;
    }

    // Versions
    const allVersions = new Set();
    if (versionSource?.patches) {
        versionSource.patches.forEach(p => {
            if (p.compatible_versions?.length > 0) {
                p.compatible_versions.forEach(v => allVersions.add(v));
            }
        });
    }
    const versionArr = [...allVersions].sort();
    const versionsRow = document.getElementById("modal-versions-row");
    if (versionArr.length === 0) {
        versionsRow.innerHTML = '<span class="version-chip any">Any version</span>';
    } else {
        versionsRow.innerHTML = versionArr.map(v =>
            '<span class="version-chip">' + escHtml(v) + '</span>'
        ).join('');
    }

    // Patch count
    const count = showPatches.length;
    document.getElementById("modal-patches-count").textContent =
        count + " patch" + (count !== 1 ? "es" : "");

    // Diff banner for updated apps
    var diffBanner = document.getElementById("modal-diff-banner");
    if (diffBanner) diffBanner.remove();
    var patchDiff = modalState.patchDiff;
    if (patchDiff && (patchDiff.patches_added.length > 0 || patchDiff.patches_removed.length > 0 || patchDiff.patches_modified.length > 0)) {
        var banner = document.createElement("div");
        banner.id = "modal-diff-banner";
        banner.className = "modal-diff-banner";
        var html = '<span class="modal-diff-label">Changes</span><div class="modal-diff-list">';
        (patchDiff.patches_added || []).forEach(function(p) {
            var name = typeof p === 'string' ? p : p.name;
            var desc = typeof p === 'object' && p.description ? p.description : '';
            html += '<div class="diff-item diff-added"><span class="diff-name">+ ' + escHtml(name) + '</span>';
            if (desc) html += '<span class="diff-desc">' + escHtml(desc) + '</span>';
            html += '</div>';
        });
        (patchDiff.patches_removed || []).forEach(function(p) {
            var name = typeof p === 'string' ? p : p.name;
            html += '<div class="diff-item diff-removed"><span class="diff-name">- ' + escHtml(name) + '</span></div>';
        });
        (patchDiff.patches_modified || []).forEach(function(p) {
            var name = typeof p === 'string' ? p : p.name;
            var desc = typeof p === 'object' && p.description ? p.description : '';
            html += '<div class="diff-item diff-modified"><span class="diff-name">~ ' + escHtml(name) + '</span>';
            if (desc) html += '<span class="diff-desc">' + escHtml(desc) + '</span>';
            html += '</div>';
        });
        html += '</div>';
        banner.innerHTML = html;
        var afterEl = document.querySelector(".modal-patches-header") || document.getElementById("modal-versions-row");
        if (afterEl && afterEl.parentNode) {
            afterEl.parentNode.insertBefore(banner, afterEl.nextSibling);
        }
    }

    // Patch list
    const patchesContainer = document.getElementById("modal-patches-list");
    if (showPatches.length === 0) {
        patchesContainer.innerHTML = '<div class="modal-no-patches">No patch details available for this app.</div>';
    } else {
        patchesContainer.innerHTML = "";
        const sorted = [...showPatches].sort((a, b) => {
            if (a.isNew && !b.isNew) return -1;
            if (!a.isNew && b.isNew) return 1;
            return 0;
        });
        sorted.forEach((patch, idx) => {
            const patchEl = buildModalPatchItem(patch, idx, channel === "dev");
            patchesContainer.appendChild(patchEl);
        });
    }
}

function closeAppModal() {
    const modal = document.getElementById("app-detail-modal");
    if (!modal) return;
    modal.classList.remove("open");

    // Re-show bundle modal if we came from there
    if (_bundleWasOpen) {
        _bundleWasOpen = false;
        var bundleModal = document.getElementById("bundle-detail-modal");
        if (bundleModal) {
            bundleModal.classList.add("open");
            document.body.style.overflow = "hidden";
            return;
        }
    }

    document.body.style.overflow = "";
}

function buildModalPatchItem(patch, idx, showDevBadges) {
    const item = document.createElement("div");
    const isOff = patch.use === false;
    const desc = patch.description || "";
    const hasOptions = patch.options && patch.options.length > 0;
    const isExpandable = desc.length > 0 || hasOptions;

    item.className = isExpandable ? "modal-patch-item expanded" : "modal-patch-item";
    item.id = "modal-patch-" + idx;

    const offTagHtml = isOff
        ? '<span class="patch-off-badge">Off by default</span>'
        : '';

    const devBadgeHtml = showDevBadges && patch.isDevOnly
        ? '<span class="badge badge-dev">DEV</span>'
        : '';
    const newBadgeHtml = showDevBadges && patch.isNew
        ? '<span class="badge badge-new-patch">NEW</span>'
        : '';

    let optionsHtml = "";
    if (hasOptions) {
        const optRows = patch.options.map(opt => `
            <div class="modal-patch-option">
                <span class="patch-option-key">${escHtml(opt.key)}</span>
                ${opt.description ? '<span class="patch-option-desc">' + escHtml(opt.description) + '</span>' : ''}
            </div>
        `).join('');
        optionsHtml = '<div class="modal-patch-options">' + optRows + '</div>';
    }

    const expandArrow = isExpandable
        ? '<span class="modal-patch-toggle-icon"><svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L10 8 6.22 4.28a.75.75 0 0 1 0-1.06z"/></svg></span>'
        : '';

    // Expandable patch names get an accent colour to signal interactivity
    const nameClass = isExpandable ? 'patch-name patch-name--clickable' : 'patch-name';

    item.innerHTML = [
        '<div class="modal-patch-header"' + (isExpandable ? ' role="button" tabindex="0"' : '') + '>',
        '  <div class="modal-patch-title-row">',
        '    <span class="' + nameClass + '">' + escHtml(patch.name) + '</span>',
        '    ' + devBadgeHtml,
        '    ' + newBadgeHtml,
        '    ' + offTagHtml,
        '  </div>',
        '  ' + expandArrow,
        '</div>',
        (isExpandable ? [
            '<div class="modal-patch-body">',
            (desc ? '<p class="modal-patch-desc">' + escHtml(desc) + '</p>' : ''),
            optionsHtml,
            '</div>'
        ].join('') : '')
    ].join('');

    // Wire up expand toggle
    if (isExpandable) {
        const header = item.querySelector(".modal-patch-header");
        header.addEventListener("click", () => {
            item.classList.toggle("expanded");
        });
        header.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                item.classList.toggle("expanded");
            }
        });
    }

    return item;
}

// ── Bundle Modal ──────────────────────────────────────────────────────────────

function openBundleModal(bundleName, bundleData) {
    const modal = document.getElementById("bundle-detail-modal");
    if (!modal) return;

    // Gather data from allBundlesData
    var stableKey = bundleName + ":stable";
    var devKey = bundleName + ":dev";
    var stableBundle = allBundlesData[stableKey];
    var devBundle = allBundlesData[devKey];

    var repoUrl = (stableBundle && stableBundle.repo_url) || (devBundle && devBundle.repo_url) || "https://github.com/" + bundleName + "/revanced-patches";
    var version = bundleData.version || (stableBundle && stableBundle.version) || (devBundle && devBundle.version) || "";
    var channels = bundleData.channels || [];
    if (stableBundle && channels.indexOf("stable") === -1) channels.push("stable");
    if (devBundle && channels.indexOf("dev") === -1) channels.push("dev");

    var repoInfo = getRepoInfo(repoUrl);
    var param = repoInfo.isGitLab ? "gitlab" : "github";
    var addMorpheUrl = "https://morphe.software/add-source?" + param + "=" + encodeURIComponent(repoInfo.path);
    var iconSvg = repoInfo.isGitLab ? gitlabSvg : githubSvg;

    document.getElementById("bundle-modal-name").textContent = bundleName;
    document.getElementById("bundle-modal-channels").textContent = "Channels: " + channels.join(", ");

    var badgesEl = document.getElementById("bundle-modal-badges");
    badgesEl.innerHTML = channels.map(function(ch) {
        return '<span class="channel-badge ' + ch + '">' + ch + '</span>';
    }).join('');

    var versionEl = document.getElementById("bundle-modal-version");
    versionEl.textContent = version || "unknown";

    var repoLink = document.getElementById("bundle-modal-repo-link");
    repoLink.href = repoUrl;
    repoLink.innerHTML = iconSvg + ' Repository';

    var addBtn = document.getElementById("bundle-modal-add-morphe");
    addBtn.href = addMorpheUrl;

    // Build apps list
    var appsList = document.getElementById("bundle-modal-apps-list");
    var allApps = [];

    if (stableBundle && stableBundle.apps) {
        stableBundle.apps.forEach(function(a) {
            if (!allApps.some(function(x) { return x.package === a.package; })) {
                allApps.push(a);
            }
        });
    }
    if (devBundle && devBundle.apps) {
        devBundle.apps.forEach(function(a) {
            if (!allApps.some(function(x) { return x.package === a.package; })) {
                allApps.push(a);
            }
        });
    }

    allApps.sort(function(a, b) {
        return resolveAppName(a).localeCompare(resolveAppName(b));
    });

    document.getElementById("bundle-modal-apps-count").textContent = allApps.length + " app" + (allApps.length !== 1 ? "s" : "");

    if (allApps.length === 0) {
        appsList.innerHTML = '<div class="modal-no-patches">No apps available in this bundle.</div>';
    } else {
        appsList.innerHTML = "";
        var frag = document.createDocumentFragment();
        allApps.forEach(function(app) {
            var card = document.createElement("div");
            card.className = "app-mini-card";
            card.setAttribute("role", "button");
            card.setAttribute("tabindex", "0");
            card.setAttribute("aria-label", "View patches for " + resolveAppName(app));

            var isPre = isAppPreRelease(bundleName, app.package, allBundlesData);
            var preBadge = isPre ? '<span class="badge badge-pre-release">Pre-Release</span>' : '';
            var patchCount = (app.patches || []).length;

            var allVersions = new Set();
            (app.patches || []).forEach(function(p) {
                if (p.compatible_versions && p.compatible_versions.length > 0) {
                    p.compatible_versions.forEach(function(v) { allVersions.add(v); });
                }
            });
            var versionArr = [...allVersions].sort();

            var versionsPreview = "";
            if (versionArr.length === 0) {
                versionsPreview = '<span class="version-chip any">Any version</span>';
            } else {
                versionsPreview = versionArr.slice(0, 3).map(function(v) {
                    return '<span class="version-chip">' + escHtml(v) + '</span>';
                }).join('');
                if (versionArr.length > 3) {
                    versionsPreview += '<span class="version-chip any">+' + (versionArr.length - 3) + '</span>';
                }
            }

            card.innerHTML = [
                '<div class="app-mini-card-main">',
                getAppIconHtml(getAppIconUrl(app)),
                '  <div class="app-mini-card-info">',
                '    <span class="app-mini-name">' + escHtml(resolveAppName(app)) + '</span>',
                '    ' + preBadge,
                '    <span class="app-mini-pkg">' + escHtml(app.package) + '</span>',
                '  </div>',
                '  <div class="app-mini-stats">',
                '    <span class="app-mini-patch-count">' + patchCount + ' patch' + (patchCount !== 1 ? "es" : "") + '</span>',
                '    <svg class="app-mini-arrow" viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L10 8 6.22 4.28a.75.75 0 0 1 0-1.06z"/></svg>',
                '  </div>',
                '</div>',
                '<div class="app-mini-versions">' + versionsPreview + '</div>'
            ].join('');

            card.addEventListener("click", function(e) {
                e.stopPropagation();
                openAppModal(app, { bundle: bundleName, channels: channels });
            });
            card.addEventListener("keydown", function(e) {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    openAppModal(app, { bundle: bundleName, channels: channels });
                }
            });

            frag.appendChild(card);
        });
        appsList.appendChild(frag);
    }

    modal.classList.add("open");
    document.body.style.overflow = "hidden";
    var closeBtn = document.getElementById("bundle-modal-close-btn");
    if (closeBtn) closeBtn.focus();
}

function closeBundleModal() {
    var modal = document.getElementById("bundle-detail-modal");
    if (!modal) return;
    modal.classList.remove("open");
    document.body.style.overflow = "";
}

// ── Toast Notification ────────────────────────────────────────────────────────

var toastTimer = null;

function showToast(message) {
    var toast = document.getElementById("toast-notification");
    var msgEl = document.getElementById("toast-message");
    if (!toast || !msgEl) return;
    msgEl.textContent = message || "New data available";
    toast.classList.add("visible");
    if (toastTimer) clearTimeout(toastTimer);
}

function hideToast() {
    var toast = document.getElementById("toast-notification");
    if (!toast) return;
    toast.classList.remove("visible");
    if (toastTimer) clearTimeout(toastTimer);
}

// Modal close wiring — runs once DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    const closeBtn = document.getElementById("modal-close-btn");
    if (closeBtn) closeBtn.addEventListener("click", closeAppModal);

    const overlay = document.getElementById("app-detail-modal");
    if (overlay) {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) closeAppModal();
        });
    }

    // Bundle modal close wiring
    var bundleCloseBtn = document.getElementById("bundle-modal-close-btn");
    if (bundleCloseBtn) bundleCloseBtn.addEventListener("click", closeBundleModal);

    var bundleOverlay = document.getElementById("bundle-detail-modal");
    if (bundleOverlay) {
        bundleOverlay.addEventListener("click", function(e) {
            if (e.target === bundleOverlay) closeBundleModal();
        });
    }

    // Toast close wiring
    var toastCloseBtn = document.getElementById("toast-close-btn");
    if (toastCloseBtn) toastCloseBtn.addEventListener("click", hideToast);

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeAppModal();
            closeBundleModal();
            hideToast();
        }
    });

    // Back to top button
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
});

// ── Changelog ─────────────────────────────────────────────────────────────────

function initChangelog() {
    // Load cached data instantly
    var cachedHtml = document.getElementById("skeleton-changelog");
    Promise.all([idbGet('changelog'), idbGet('live'), idbGet('icons'), idbGet('names')]).then(function(items) {
        if (items[0] && items[1] && items[2]) {
            if (cachedHtml) cachedHtml.style.display = "none";
            iconCache = items[2];
            if (items[3]) nameCache = items[3];
            renderChangelog(items[0], (items[1].bundles || {}));
        }
    }).catch(function() {});

    // Fetch fresh data in background
    Promise.all([
        fetch("data/changelog.json").then(function(res) {
            if (!res.ok) throw new Error("Changelog status " + res.status);
            return res.json();
        }),
        fetch("data/live.json").then(function(res) {
            if (!res.ok) throw new Error("Live status " + res.status);
            return res.json();
        }),
        fetch("data/state/icon_cache.json")
            .then(function(res) { return res.ok ? res.json() : {}; })
            .catch(function() { return {}; }),
        fetch("data/state/name_cache.json")
            .then(function(res) { return res.ok ? res.json() : {}; })
            .catch(function() { return {}; })
    ])
    .then(function(items) {
        if (cachedHtml) cachedHtml.style.display = "none";
        iconCache = items[2];
        if (items[3]) nameCache = items[3];
        renderChangelog(items[0], (items[1].bundles || {}));
        idbSet('changelog', items[0]);
        idbSet('live', items[1]);
        idbSet('icons', items[2]);
        idbSet('names', items[3]);
    })
    .catch(function(err) {
        console.error("[MorpheTracker] ERROR loading changelog data:", err);
        if (cachedHtml) cachedHtml.style.display = "none";
        var container = document.getElementById("changelog-list-container");
        if (container) {
            container.innerHTML = '<div class="error-state">Failed to load changelog data: ' + err.message + '. Ensure data/changelog.json and data/live.json are generated.</div>';
        }
    });
}

function renderChangelog(changelog, bundlesData) {
    const container = document.getElementById("changelog-list-container");
    if (!container) return;

    if (!changelog || changelog.length === 0) {
        container.innerHTML = '<div class="loading-state">No changelog entries found.</div>';
        return;
    }

    container.innerHTML = "";

    changelog.forEach(day => {
        const card = document.createElement("div");
        card.className = "changelog-day-card";

        const affectedBundles = day.affected_bundles || [];

        const grouped = groupAffectedBundles(affectedBundles);

        const sortedBundleNames = Object.keys(grouped).sort((a, b) => {
            const aIsNew = grouped[a].badge_type === "NEW BUNDLE";
            const bIsNew = grouped[b].badge_type === "NEW BUNDLE";
            if (aIsNew && !bIsNew) return -1;
            if (!aIsNew && bIsNew) return 1;
            const aHasNewApps = grouped[a].apps.some(app => app.badge_type === "NEW APP");
            const bHasNewApps = grouped[b].apps.some(app => app.badge_type === "NEW APP");
            if (aHasNewApps && !bHasNewApps) return -1;
            if (!aHasNewApps && bHasNewApps) return 1;
            return a.localeCompare(b);
        });
        let dayHtml = "";

        sortedBundleNames.forEach(bName => {
            const bGroup = grouped[bName];
            const isNewBundle = bGroup.badge_type === "NEW BUNDLE";

            let channelsStr = bGroup.channels.join(", ");
            let headerHtml = "";
            if (isNewBundle) {
                headerHtml = `
                    <div class="changelog-bundle-header">
                        <span class="badge badge-new-bundle">NEW BUNDLE</span>
                        <span>Bundle <a href="index.html#bundle=${encodeURIComponent(bName)}" class="changelog-bundle-link"><strong>${bName} patches</strong></a> (${channelsStr})</span>
                    </div>
                `;
            } else {
                headerHtml = `
                    <div class="changelog-bundle-header">
                        <span class="badge badge-updated">UPDATED</span>
                        <span>Bundle <a href="index.html#bundle=${encodeURIComponent(bName)}" class="changelog-bundle-link"><strong>${bName} patches</strong></a></span>
                    </div>
                `;
            }

            // Use innerHTML then attach event for bundle modal
            // We'll wire the link after the fact

            let appsListHtml = "";
            if (bGroup.apps.length > 0) {
                appsListHtml += `<ul class="changelog-bundle-apps">`;

                const appBadgeMap = {
                    "NEW APP": '<span class="badge badge-new">NEW APP</span>',
                    "UPDATED APP": '<span class="badge badge-updated">UPDATED APP</span>',
                    "REMOVED APP": '<span class="badge badge-removed">REMOVED APP</span>'
                };

                // Sort: NEW APP first, then UPDATED APP, then REMOVED APP
            const sortOrder = {"NEW APP": 0, "UPDATED APP": 1, "REMOVED APP": 2};
                bGroup.apps.sort(function(a, b) {
                    return (sortOrder[a.badge_type] ?? 1) - (sortOrder[b.badge_type] ?? 1);
                });

                bGroup.apps.forEach(app => {
                    const badgeHtml = appBadgeMap[app.badge_type] || appBadgeMap["NEW APP"];
                    const isPre = isAppPreRelease(bName, app.package, bundlesData);
                    const preReleaseBadge = isPre ? '<span class="badge badge-pre-release">PRE-RELEASE</span>' : '';
                    const appIconHtml4 = getAppIconHtml(getAppIconUrl(app));
                    const playLink = `<a href="https://play.google.com/store/apps/details?id=${app.package}" target="_blank" class="app-play-link">${escHtml(resolveAppName(app))}</a>`;
                    const scanBadges = (app.scan_numbers || []).map(sn => `<span class="badge badge-scan" title="${sn}${ordinalSuffix(sn)} scan batch">${sn}</span>`).join(' ');

                    appsListHtml += `
                        <li class="changelog-item">
                            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                                ${badgeHtml}
                                ${preReleaseBadge}
                                ${appIconHtml4}
                                <span><strong class="highlight-app">${playLink}</strong> ${scanBadges}</span>
                            </div>
                        </li>
                    `;
                });

                appsListHtml += `</ul>`;
            }

            dayHtml += `
                <div class="changelog-bundle-group">
                    ${headerHtml}
                    ${appsListHtml}
                </div>
            `;
        });

        if (!dayHtml) {
            dayHtml = '<div class="loading-state" style="padding: 1rem;">No major changes recorded on this date.</div>';
        }

        card.innerHTML = `
            <div class="changelog-date-header">${formatFriendlyDate(day.date)}</div>
            ${dayHtml}
        `;

        container.appendChild(card);

        // Wire bundle links to open bundle modal (prevent navigation from changelog page)
        var bundleLinks = card.querySelectorAll(".changelog-bundle-link");
        bundleLinks.forEach(function(link) {
            link.addEventListener("click", function(e) {
                e.preventDefault();
                var bundleName = link.querySelector("strong") ? link.querySelector("strong").textContent.trim() : link.textContent.trim();
                var foundGroup = grouped[bundleName];
                var channels = foundGroup ? foundGroup.channels : [];
                openBundleModal(bundleName, {
                    version: "",
                    channels: channels
                });
            });
        });
    });
}

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", function(event) {
        if (event.data && event.data.type === "DATA_UPDATED") {
            showToast("New data available — click to refresh");

            // On toast click, refresh data
            var toast = document.getElementById("toast-notification");
            if (toast) {
                var doRefresh = function() {
                    hideToast();
                    var isDashboard = document.getElementById("nav-dashboard") && document.getElementById("nav-dashboard").classList.contains("active");
                    if (isDashboard) {
                        fetch("data/live.json?_t=" + Date.now()).then(function(res) { return res.json(); }).then(function(data) {
                            renderStats(data);
                            renderTodayUpdates(data);
                            for (const key in data.bundles) {
                                allBundlesData[key] = Object.assign({}, data.bundles[key], { key: key });
                            }
                            filterAndRenderBundles();
                        }).catch(function() {});
                    } else {
                        initChangelog();
                    }
                    toast.removeEventListener("click", doRefresh);
                };
                toast.addEventListener("click", doRefresh);
            }
        }
    });
}
