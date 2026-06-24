// Dynamic UI engine
document.addEventListener("DOMContentLoaded", () => {
    console.log("[MorpheTracker] DOM ready - determining page type");

    const isDashboard = document.getElementById("nav-dashboard") && document.getElementById("nav-dashboard").classList.contains("active");
    const isChangelog = document.getElementById("nav-changelog") && document.getElementById("nav-changelog").classList.contains("active");

    console.log("[MorpheTracker] Page detection - isDashboard:", isDashboard, "| isChangelog:", isChangelog);

    if (isDashboard) {
        console.log("[MorpheTracker] Initializing Dashboard page");
        initDashboard();
    } else if (isChangelog) {
        console.log("[MorpheTracker] Initializing Changelog page");
        initChangelog();
    } else {
        console.warn("[MorpheTracker] Could not determine page type!");
    }
});

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

let allBundlesData = {};
let iconCache = {};
let currentFilters = {
    search: "",
    channel: "all"
};

function initDashboard() {
    console.log("[MorpheTracker] initDashboard() started - fetching live.json and icon cache");

    Promise.all([
        fetch("data/live.json").then(res => {
            console.log("[MorpheTracker] live.json fetch status:", res.status, res.statusText);
            if (!res.ok) throw new Error("Status " + res.status);
            return res.json();
        }),
        fetch("data/state/icon_cache.json")
            .then(res => {
                console.log("[MorpheTracker] icon_cache.json fetch status:", res.status, res.statusText);
                return res.ok ? res.json() : {};
            })
            .catch(() => ({}))
    ])
        .then(([data, cache]) => {
            console.log("[MorpheTracker] live.json loaded successfully. Stats:", data.stats);
            console.log("[MorpheTracker] Bundle count:", Object.keys(data.bundles || {}).length);
            console.log("[MorpheTracker] Changes found:", (data.changes?.affected_bundles || []).length);

            iconCache = cache;
            renderStats(data);

            // Enrich bundles data with key
            allBundlesData = {};
            for (const [key, b] of Object.entries(data.bundles || {})) {
                allBundlesData[key] = { ...b, key: key };
            }
            console.log("[MorpheTracker] Enriched allBundlesData with", Object.keys(allBundlesData).length, "entries");

            renderTodayUpdates(data);
            setupDashboardFilters();
            filterAndRenderBundles();

            // After rendering, check URL hash for a bundle highlight target
            scrollToHighlightedBundle();

            console.log("[MorpheTracker] Dashboard initialization complete");
        })
        .catch(err => {
            console.error("[MorpheTracker] ERROR loading live.json:", err);
            console.error("[MorpheTracker] Stack:", err.stack);
            const container = document.getElementById("bundles-grid-container");
            if (container) {
                container.innerHTML = `<div class="error-state">Failed to load dashboard data: ${err.message}. Ensure data/live.json exists.</div>`;
            }
        });
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
                <span>Bundle <a href="#bundle=${encodeURIComponent(bName)}" class="changelog-bundle-link"><strong>${bName}</strong></a> (${channelsStr}) added by ${authorHtml}</span>
            `;
        } else {
            bundleRow.innerHTML = `
                <span class="badge badge-updated-bundle">UPDATED</span>
                <span><a href="#bundle=${encodeURIComponent(bName)}" class="changelog-bundle-link"><strong>${bName}</strong></a> patches</span>
            `;
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

                var appRow = document.createElement("div");
                appRow.className = "update-row";
                appRow.innerHTML = [
                    badgeHtml,
                    preReleaseBadge,
                    appIconHtml3,
                    '<span><strong class="changelog-app-link">' + escHtml(app.app_name) + '</strong> in ' + bName + ' patches</span>'
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
                            openAppModal(appData, { bundle: bundleName, channels: channels });
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

function setupDashboardFilters() {
    const searchInput = document.getElementById("search-input");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            currentFilters.search = e.target.value.toLowerCase().trim();
            filterAndRenderBundles();
        });
    }

    const filterButtons = document.querySelectorAll(".filter-group .filter-btn");
    filterButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            filterButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentFilters.channel = btn.getAttribute("data-channel");
            filterAndRenderBundles();
        });
    });
}

function filterAndRenderBundles() {
    console.log("[MorpheTracker] filterAndRenderBundles() called - channel:", currentFilters.channel, "| search:", currentFilters.search);

    const container = document.getElementById("bundles-grid-container");
    if (!container) {
        console.warn("[MorpheTracker] bundles-grid-container not found");
        return;
    }

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
                apps: [...(b.apps || [])]
            };
        } else {
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
    console.log("[MorpheTracker] Grouped into", list.length, "bundle cards (before filter)");

    // Apply search filter
    if (currentFilters.search) {
        const query = currentFilters.search;
        list = list.filter(b => {
            const matchBundle = b.bundle.toLowerCase().includes(query);
            const matchApp = b.apps && b.apps.some(app =>
                app.app_name.toLowerCase().includes(query) ||
                app.package.toLowerCase().includes(query)
            );
            return matchBundle || matchApp;
        });
        console.log("[MorpheTracker] After search filter:", list.length, "cards");
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
        console.log("[MorpheTracker] No matching bundles, showing empty state");
        container.innerHTML = '<div class="loading-state">No matching Morphe bundles found.</div>';
        return;
    }

    container.innerHTML = "";
    console.log("[MorpheTracker] Rendering", list.length, "bundle cards");
    list.forEach(b => {
        const card = buildBundleCard(b);
        container.appendChild(card);
    });
    console.log("[MorpheTracker] Bundle cards rendered successfully");
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
                grouped[bName].apps.push({...app});
            } else if (appPrecedence[app.badge_type] < appPrecedence[existing.badge_type]) {
                existing.badge_type = app.badge_type;
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
    console.log("[MorpheTracker] buildBundleCard() for bundle:", bundle.bundle, "apps:", (bundle.apps || []).length);

    const card = document.createElement("div");
    card.className = "bundle-card";
    card.dataset.bundleName = bundle.bundle;

    const apps = [...(bundle.apps || [])];
    apps.sort((x, y) => x.app_name.localeCompare(y.app_name));
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

    card.innerHTML = [
        '<div class="bundle-card-header">',
        '  <div class="bundle-title-group">',
        '    <span class="bundle-name-title" title="' + escHtml(bundle.bundle) + '">' + escHtml(bundle.bundle) + '</span>',
        '    <div class="channel-badges-group">' + badgesHtml + '</div>',
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
        console.log("[MorpheTracker] Bundle card clicked:", bundle.bundle, "current expanded:", card.classList.contains("expanded"));
        card.classList.toggle("expanded");
        console.log("[MorpheTracker] Card now expanded:", card.classList.contains("expanded"));
    });

    console.log("[MorpheTracker] Bundle card built for:", bundle.bundle);
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
        appCard.setAttribute("aria-label", "View patches for " + app.app_name);

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
            '    <span class="app-mini-name">' + escHtml(app.app_name) + '</span>',
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

function openAppModal(app, bundle) {
    const modal = document.getElementById("app-detail-modal");
    if (!modal) return;

    // Populate header
    const modalIconHtml = getAppIconHtml(getAppIconUrl(app), "app-icon app-icon-modal");
    document.getElementById("modal-app-name").innerHTML = modalIconHtml + escHtml(app.app_name);

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

    // Merge patches from stable and dev channels, flagging dev-only ones
    const stableBundleData = allBundlesData[`${bundle.bundle}:stable`];
    const devBundleData    = allBundlesData[`${bundle.bundle}:dev`];

    const stableApp = stableBundleData?.apps?.find(a => a.package === app.package);
    const devApp    = devBundleData?.apps?.find(a => a.package === app.package);

    const stablePatches = stableApp?.patches || [];
    const devPatches    = devApp?.patches    || [];

    const stablePatchNames = new Set(stablePatches.map(p => p.name));
    const mergedPatches = [
        ...stablePatches,
        ...devPatches
            .filter(p => !stablePatchNames.has(p.name))
            .map(p => ({ ...p, isDevOnly: true }))
    ];

    // Collect compatible versions from all merged patches
    const allVersions = new Set();
    mergedPatches.forEach(p => {
        if (p.compatible_versions?.length > 0) {
            p.compatible_versions.forEach(v => allVersions.add(v));
        }
    });
    const versionArr = [...allVersions].sort();

    const versionsRow = document.getElementById("modal-versions-row");
    if (versionArr.length === 0) {
        versionsRow.innerHTML = '<span class="version-chip any">Any version</span>';
    } else {
        versionsRow.innerHTML = versionArr.map(v =>
            '<span class="version-chip">' + escHtml(v) + '</span>'
        ).join('');
    }

    // Patch count (total merged)
    document.getElementById("modal-patches-count").textContent =
        mergedPatches.length + " patch" + (mergedPatches.length !== 1 ? "es" : "");

    // Patch list
    const patchesContainer = document.getElementById("modal-patches-list");
    if (mergedPatches.length === 0) {
        patchesContainer.innerHTML = '<div class="modal-no-patches">No patch details available for this app.</div>';
    } else {
        patchesContainer.innerHTML = "";
        mergedPatches.forEach((patch, idx) => {
            const patchEl = buildModalPatchItem(patch, idx);
            patchesContainer.appendChild(patchEl);
        });
    }

    // Show modal
    modal.classList.add("open");
    document.body.style.overflow = "hidden";

    // Focus the close button for accessibility
    const closeBtn = document.getElementById("modal-close-btn");
    if (closeBtn) closeBtn.focus();
}

function closeAppModal() {
    const modal = document.getElementById("app-detail-modal");
    if (!modal) return;
    modal.classList.remove("open");
    document.body.style.overflow = "";
}

function buildModalPatchItem(patch, idx) {
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

    const devBadgeHtml = patch.isDevOnly
        ? '<span class="badge badge-dev">DEV</span>'
        : '';
    const newBadgeHtml = patch.isDevOnly
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

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeAppModal();
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
    console.log("[MorpheTracker] initChangelog() started - fetching changelog.json, live.json, and icon cache");

    Promise.all([
        fetch("data/changelog.json").then(res => {
            console.log("[MorpheTracker] changelog.json fetch status:", res.status, res.statusText);
            if (!res.ok) throw new Error("Changelog status " + res.status);
            return res.json();
        }),
        fetch("data/live.json").then(res => {
            console.log("[MorpheTracker] live.json (changelog) fetch status:", res.status, res.statusText);
            if (!res.ok) throw new Error("Live status " + res.status);
            return res.json();
        }),
        fetch("data/state/icon_cache.json")
            .then(res => {
                console.log("[MorpheTracker] icon_cache.json (changelog) fetch status:", res.status, res.statusText);
                return res.ok ? res.json() : {};
            })
            .catch(() => ({}))
    ])
    .then(([changelog, liveData, cache]) => {
        console.log("[MorpheTracker] Changelog data loaded. Entries:", changelog ? changelog.length : 0);
        iconCache = cache;
        renderChangelog(changelog, liveData.bundles);
        console.log("[MorpheTracker] Changelog rendering complete");
    })
    .catch(err => {
        console.error("[MorpheTracker] ERROR loading changelog data:", err);
        console.error("[MorpheTracker] Stack:", err.stack);
        const container = document.getElementById("changelog-list-container");
        if (container) {
            container.innerHTML = `<div class="error-state">Failed to load changelog data: ${err.message}. Ensure data/changelog.json and data/live.json are generated.</div>`;
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

            let headerHtml = "";
            if (isNewBundle) {
                const channelsStr = bGroup.channels.join(", ");
                headerHtml = `
                    <div class="changelog-bundle-header">
                        <span class="badge badge-new-bundle">NEW BUNDLE</span>
                        <span>Bundle <a href="index.html#bundle=${encodeURIComponent(bName)}" class="changelog-bundle-link"><strong>${bName}</strong></a> (${channelsStr})</span>
                    </div>
                `;
            } else {
                headerHtml = `
                    <div class="changelog-bundle-header">
                        <span class="badge badge-updated">UPDATED</span>
                        <span>Bundle <a href="index.html#bundle=${encodeURIComponent(bName)}" class="changelog-bundle-link"><strong>${bName}</strong></a> patches</span>
                    </div>
                `;
            }

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
                    const playLink = `<a href="https://play.google.com/store/apps/details?id=${app.package}" target="_blank" class="app-play-link">${app.app_name}</a>`;

                    appsListHtml += `
                        <li class="changelog-item">
                            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                                ${badgeHtml}
                                ${preReleaseBadge}
                                ${appIconHtml4}
                                <span><strong class="highlight-app">${playLink}</strong> in ${bName} patches</span>
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
    });
}

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", function(event) {
        if (event.data && event.data.type === "DATA_UPDATED") {
            const isDashboard = document.getElementById("nav-dashboard") && document.getElementById("nav-dashboard").classList.contains("active");
            if (isDashboard) {
                fetch("data/live.json").then(function(res) { return res.json(); }).then(function(data) {
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
        }
    });
}
