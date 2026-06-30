function initDashboard() {
    log("initDashboard", "START");
    const checkingEl = document.getElementById("checking-message");
    const skelUpdates = document.getElementById("skeleton-updates");
    const skelGrid = document.getElementById("skeleton-grid");

    applyFiltersFromUrl();

    fetchLastChecked().then(function(lc) {
        if (lc) cachedLastCheckedOverride = lc;
    });
    Promise.all([idbGet(CACHE_KEYS.LIVE), idbGet(CACHE_KEYS.ICONS), idbGet(CACHE_KEYS.NAMES)]).then(function(items) {
        log("initDashboard", "Cache load: live=" + !!items[0] + " icons=" + !!items[1] + " names=" + !!items[2]);
        if (items[0] && items[1]) {
            cachedLastRun = items[0].last_run || items[0].lastChecked || "";
            liveDataDate = items[0].date || "";
            log("initDashboard", "Date=" + liveDataDate + " lastRun=" + cachedLastRun);
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
            log("initDashboard", "Bundles loaded=" + Object.keys(allBundlesData).length);
            renderTodayUpdates(items[0]);
            renderScanInfo(items[0]);
            setupDashboardFilters();
            filterAndRenderBundles();
            scrollToHighlightedBundle();
        } else {
            log("initDashboard", "Incomplete cached data, waiting for network");
        }
    }).catch(function(err) { log("initDashboard", "Cache load error: " + err); });

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
    log("runCheckPhase", "START");
    const checkingEl = document.getElementById("checking-message");

    fetchAllData().then(data => {
        const lastRun = data.last_run || data.lastChecked || "";
        const storedRun = localStorage.getItem("morphe_last_run") || "";
        log("runCheckPhase", "lastRun=" + lastRun + " storedRun=" + storedRun);

        if (lastRun && lastRun !== storedRun) {
            if (checkingEl) checkingEl.textContent = "New updates found!";
            localStorage.setItem("morphe_last_run", lastRun);
            localStorage.setItem("morphe_versions", JSON.stringify(getBundleVersions(data)));
            log("runCheckPhase", "NEW UPDATES FOUND");
        } else {
            if (checkingEl) checkingEl.textContent = "Up to date";
            log("runCheckPhase", "Up to date");
        }

        sessionStorage.setItem("morphe_checked", "1");

        Promise.all([
            fetch("data/state/icon_cache.json").then(r => r.ok ? r.json() : {}).catch(() => ({})),
            fetch("data/state/name_cache.json").then(r => r.ok ? r.json() : {}).catch(() => ({})),
            fetchLastChecked()
        ]).then(function(items) {
            if (items[2]) cachedLastCheckedOverride = items[2];
            log("runCheckPhase", "Icons=" + Object.keys(items[0]||{}).length + " Names=" + Object.keys(items[1]||{}).length + " LastChecked=" + (items[2]||"-"));
            setTimeout(function() {
                finalizeDashboard(data, items[0], items[1]);
            }, 600);
        });
    })
    .catch(() => {
        log("runCheckPhase", "data fetch failed, fallback to fetchAndRenderDashboard");
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
    log("fetchAndRenderDashboard", "START");
    Promise.all([
        fetchAllData(),
        fetch("data/state/icon_cache.json").then(r => r.ok ? r.json() : {}).catch(() => ({})),
        fetch("data/state/name_cache.json").then(r => r.ok ? r.json() : {}).catch(() => ({})),
        fetchLastChecked()
    ])
        .then(([data, cache, names, lc]) => {
            if (lc) cachedLastCheckedOverride = lc;
            log("fetchAndRenderDashboard", "SUCCESS, bundles=" + Object.keys(data.bundles||{}).length);
            finalizeDashboard(data, cache, names);
        })
        .catch(err => {
            log("fetchAndRenderDashboard", "ERROR: " + err.message);
            console.error("[MorpheTracker] ERROR loading dashboard data:", err);
            const container = document.getElementById("bundles-grid-container");
            if (container) {
                container.innerHTML = `<div class="error-state">Failed to load dashboard data: ${err.message}. Ensure data files exist.</div>`;
            }
        });
}

function finalizeDashboard(data, cache, names) {
    var newRun = data.last_run || data.lastChecked || "";
    if (newRun && newRun === cachedLastRun && Object.keys(allBundlesData).length > 0) {
        log("finalizeDashboard", "SKIP (no change), newRun=" + newRun);
        return;
    }
    log("finalizeDashboard", "START, newRun=" + newRun + " bundles=" + Object.keys(data.bundles||{}).length);
    cachedLastRun = newRun;
    liveDataDate = data.date || "";

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
    renderScanInfo(data);
    setupDashboardFilters();
    filterAndRenderBundles();
    scrollToHighlightedBundle();

    idbSet(CACHE_KEYS.LIVE, data);
    idbSet(CACHE_KEYS.ICONS, iconCache);
    idbSet(CACHE_KEYS.NAMES, nameCache);
    log("finalizeDashboard", "DONE");
}

window.addEventListener("hashchange", scrollToHighlightedBundle);

function scrollToHighlightedBundle() {
    const hash = window.location.hash;
    if (!hash.startsWith("#bundle=")) return;

    const targetBundleName = decodeURIComponent(hash.slice("#bundle=".length));
    if (!targetBundleName) return;

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
    var lastChecked = cachedLastCheckedOverride || data.lastChecked || data.last_run;
    document.getElementById("val-last-checked").textContent = formatTime(lastChecked);

    var agoEl = document.getElementById("val-last-checked-ago");
    if (agoEl) {
        agoEl.textContent = "(" + getTimeAgo(lastChecked) + ")";
    }
    var dot = document.getElementById("scan-freshness-dot");
    if (dot) {
        var todayStr = new Date().toISOString().split('T')[0];
        if (liveDataDate === todayStr) {
            dot.className = "scan-pulse scan-pulse--fresh";
        } else {
            dot.className = "scan-pulse";
        }
    }
}

function renderScanInfo(data) {
    if (scanTimerInterval) clearInterval(scanTimerInterval);
    updateScanClocks(data);
    scanTimerInterval = setInterval(function() { updateScanClocks(data); }, 1000);
}

function isScanWindowActive() {
    var now = new Date();
    var utcMin = now.getUTCMinutes();
    var utcSec = now.getUTCSeconds();
    return utcMin <= 3 && utcSec < 30;
}

function updateScanClocks(data) {
    var now = new Date();

    var utcEl = document.getElementById("scan-utc-time");
    if (utcEl) {
        utcEl.textContent = padNum(now.getUTCHours()) + ":" + padNum(now.getUTCMinutes()) + ":" + padNum(now.getUTCSeconds());
    }

    var localEl = document.getElementById("scan-local-time");
    if (localEl) {
        var h = now.getHours();
        var ampm = h >= 12 ? "PM" : "AM";
        h = h % 12 || 12;
        localEl.textContent = h + ":" + padNum(now.getMinutes()) + ":" + padNum(now.getSeconds()) + " " + ampm;
    }

    var lc = data ? (cachedLastCheckedOverride || data.lastChecked || data.last_run) : "";
    var nextScan = lc ? new Date(new Date(lc).getTime() + 3 * 3600000) : getNextScanTime();
    var diffMs = nextScan - now;
    var totalSec = Math.max(0, Math.floor(diffMs / 1000));
    var hrs = Math.floor(totalSec / 3600);
    var mins = Math.floor((totalSec % 3600) / 60);
    var secs = totalSec % 60;
    var countdownEl = document.getElementById("scan-countdown");
    if (countdownEl) {
        var isScanning = isScanWindowActive();
        if (isScanning) {
            countdownEl.textContent = "SCANNING...";
            countdownEl.classList.add("scan-countdown--scanning");
        } else {
            countdownEl.textContent = padNum(hrs) + ":" + padNum(mins) + ":" + padNum(secs);
            countdownEl.classList.remove("scan-countdown--scanning");
            countdownEl.classList.toggle("scan-countdown--urgent", totalSec < 300);
        }
    }

    var batchEl = document.getElementById("scan-today-count");
    if (batchEl) {
        batchEl.textContent = "Scan " + getScanBatch() + " of 8";
    }

    var agoEl = document.getElementById("scan-last-run-ago");
    if (agoEl && data) {
        var lastChecked = cachedLastCheckedOverride || data.lastChecked || data.last_run;
        agoEl.textContent = lastChecked ? getTimeAgo(lastChecked) : "-";
    }



    var dot = document.getElementById("scan-freshness-dot");
    if (dot) {
        var todayStr = now.toISOString().split('T')[0];
        if (liveDataDate === todayStr) {
            dot.className = "scan-pulse scan-pulse--fresh";
        } else {
            dot.className = "scan-pulse";
        }
    }

    var statsAgo = document.getElementById("val-last-checked-ago");
    if (statsAgo && data) {
        var lastChecked = cachedLastCheckedOverride || data.lastChecked || data.last_run;
        statsAgo.textContent = "(" + getTimeAgo(lastChecked) + ")";
    }
}

function renderTodayUpdates(data) {
    const updatesLabel = document.getElementById("updates-date-label");
    const container = document.getElementById("today-updates-container");
    if (!container) return;

    var lc = cachedLastCheckedOverride || data.lastChecked || data.last_run || "";
    var updateDate = data.date || (lc ? lc.split('T')[0] : "");
    updatesLabel.textContent = updateDate ? `Updated: ${formatFriendlyDate(updateDate)}` : "Updated: -";
    log("renderTodayUpdates", "lastChecked=" + lc + " date=" + updateDate + " affected=" + ((data.changes && data.changes.affected_bundles) || []).length);

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
            var bVersion = bGroup.version || "";
            var versionTag = bVersion ? ' <span class="bundle-version-tag">' + escHtml(bVersion) + '</span>' : '';
            bundleRow.innerHTML = `
                <span class="badge badge-updated-bundle">UPDATED</span>
                <span><a href="#bundle=${encodeURIComponent(bName)}" class="changelog-bundle-link"><strong>${bName} patches</strong></a>` + versionTag + `</span>
            `;
        }

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

            const sortOrder = {"NEW APP": 0, "UPDATED APP": 1, "REMOVED APP": 2};
            bGroup.apps.sort(function(a, b) {
                return (sortOrder[a.badge_type] ?? 1) - (sortOrder[b.badge_type] ?? 1);
            });

            bGroup.apps.forEach(function(app) {
                var badgeHtml = appBadgeMap[app.badge_type] || appBadgeMap["NEW APP"];
                var isPre = isAppPreRelease(bName, app.package, data.bundles);
                var preReleaseBadge = isPre ? '<span class="badge badge-pre-release">PRE-RELEASE</span>' : '';
                var promotedBadge = app.promoted_from ? '<span class="badge badge-promoted">MOVED TO STABLE</span>' : '';
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
                    promotedBadge,
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

    var viewOpts = document.querySelectorAll(".view-toggle-opt");
    viewOpts.forEach(function(btn) {
        btn.addEventListener("click", function() {
            var view = this.getAttribute("data-view");
            if (view === currentView) return;
            currentView = view;
            localStorage.setItem("morphe_view", currentView);
            updateViewToggleUI();
            applyViewMode();
        });
    });
    updateViewToggleUI();
    applyViewMode();
}

function updateViewToggleUI() {
    var opts = document.querySelectorAll(".view-toggle-opt");
    opts.forEach(function(btn) {
        var view = btn.getAttribute("data-view");
        btn.classList.toggle("active", view === currentView);
    });
}

function applyViewMode() {
    var container = document.getElementById("bundles-grid-container");
    if (!container) return;
    container.classList.toggle("list-view", currentView === "list");
    var cards = container.querySelectorAll(".bundle-card");
    cards.forEach(function(c) {
        c.classList.toggle("compact", currentView === "list");
    });
}

function filterAndRenderBundles() {
    const container = document.getElementById("bundles-grid-container");
    if (!container) return;

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
    applyViewMode();
}

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
        var todayStr = new Date().toISOString().split('T')[0];
        if (liveDataDate === todayStr) {
            const storedVersions = JSON.parse(localStorage.getItem("morphe_versions") || "{}");
            const prevVersion = storedVersions[bundle.bundle];
            if (prevVersion && prevVersion !== bundle.version) {
                updatedBadge = '<span class="bundle-updated-badge">Updated</span>';
            }
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
        '<div class="bundle-card-actions">',
        '<a href="' + escHtml(addMorpheUrl) + '" class="add-morphe-btn" target="_blank" onclick="event.stopPropagation()">Add to Morphe</a>',
        '<button class="history-btn" data-bundle="' + escHtml(bundle.bundle) + '" title="View changelog history"><svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3 1.5a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/></svg></button>',
        '</div>'
    ].join('');

    buildAppCardsDrawer(card, bundle, apps);

    card.addEventListener("click", function(e) {
        if (currentView === "list") {
            window.location.hash = "bundle=" + encodeURIComponent(bundle.bundle);
            openBundleModal(bundle.bundle, {
                version: bundle.version || "",
                channels: bundle.channels
            });
            return;
        }
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

        appCard.addEventListener("click", (e) => {
            e.stopPropagation();
            openAppModal(app, bundle);
        });

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
