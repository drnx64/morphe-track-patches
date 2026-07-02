function initChangelog() {
    log("initChangelog", "START");
    var cachedHtml = document.getElementById("skeleton-changelog");

    function populateBundleData(liveData) {
        allBundlesData = {};
        for (const [key, b] of Object.entries(liveData.bundles || {})) {
            allBundlesData[key] = { ...b, key: key };
        }
        log("initChangelog", "populateBundleData: " + Object.keys(allBundlesData).length + " entries");
    }

    Promise.all([idbGet(CACHE_KEYS.CHANGELOG), idbGet(CACHE_KEYS.LIVE), idbGet(CACHE_KEYS.ICONS), idbGet(CACHE_KEYS.NAMES)]).then(function(items) {
        log("initChangelog", "Cache: changelog=" + !!items[0] + " live=" + !!items[1] + " icons=" + !!items[2]);
        if (items[0] && items[1] && items[2]) {
            if (cachedHtml) cachedHtml.style.display = "none";
            iconCache = items[2];
            if (items[3]) nameCache = items[3];
            liveDataDate = items[1].date || "";
            populateBundleData(items[1]);
            renderChangelog(items[0], (items[1].bundles || {}));
            renderScanInfo(items[1]);
            setupChangelogViewToggle();
        }
    }).catch(function(err) { log("initChangelog", "Cache error: " + err); });

    function setupChangelogViewToggle() {
        var toggleGroup = document.getElementById("changelog-view-toggle");
        if (!toggleGroup) return;
        var opts = toggleGroup.querySelectorAll(".view-toggle-opt");
        var savedView = localStorage.getItem("morphe_changelog_view") || "grid";
        var container = document.getElementById("changelog-list-container");
        function applyChangelogView(view) {
            if (container) container.classList.toggle("changelog-compact", view === "list");
            opts.forEach(function(b) {
                b.classList.toggle("active", b.getAttribute("data-view") === view);
            });
        }
        applyChangelogView(savedView);
        opts.forEach(function(btn) {
            btn.addEventListener("click", function() {
                var view = this.getAttribute("data-view");
                if (view === savedView) return;
                savedView = view;
                localStorage.setItem("morphe_changelog_view", savedView);
                applyChangelogView(savedView);
            });
        });
    }

    fetch("data/state/icon_cache.json")
        .then(function(res) { return res.ok ? res.json() : {}; })
        .catch(function() { return {}; })
        .then(function(iconData) {
            iconCache = iconData;
            idbSet(CACHE_KEYS.ICONS, iconCache);
            preloadIcons(iconCache);
            return fetch("data/state/name_cache.json")
                .then(function(res) { return res.ok ? res.json() : {}; })
                .catch(function() { return {}; });
        })
        .then(function(nameData) {
            if (nameData) nameCache = nameData;
            idbSet(CACHE_KEYS.NAMES, nameCache);
            return Promise.all([
                fetch("data/changelog.json").then(function(res) {
                    if (!res.ok) throw new Error("Changelog status " + res.status);
                    return res.json();
                }),
                fetchAllData()
            ]);
        })
        .then(function(items) {
            log("initChangelog", "Network: changelog entries=" + (items[0]||[]).length + " bundles=" + Object.keys(items[1].bundles||{}).length);
            if (cachedHtml) cachedHtml.style.display = "none";
            liveDataDate = items[1].date || "";
            populateBundleData(items[1]);
            renderChangelog(items[0], (items[1].bundles || {}));
            renderScanInfo(items[1]);
            setupChangelogViewToggle();
            idbSet(CACHE_KEYS.CHANGELOG, items[0]);
            idbSet(CACHE_KEYS.LIVE, items[1]);
        })
    .catch(function(err) {
        log("initChangelog", "ERROR: " + err.message);
        console.error("[MorpheTracker] ERROR loading changelog data:", err);
        if (cachedHtml) cachedHtml.style.display = "none";
        var container = document.getElementById("changelog-list-container");
        if (container) {
            container.innerHTML = '<div class="error-state">Failed to load changelog data: ' + err.message + '. Ensure data files are generated.</div>';
        }
    });
}

function renderChangelog(changelog, bundlesData) {
    const container = document.getElementById("changelog-list-container");
    if (!container) return;
    log("renderChangelog", "entries=" + (changelog || []).length + " bundlesData keys=" + Object.keys(bundlesData).length);

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
            var bStableKey = bName + ":stable";
            var bDevKey = bName + ":dev";
            var bRepoUrl = (bundlesData[bStableKey] && bundlesData[bStableKey].repo_url) ||
                           (bundlesData[bDevKey] && bundlesData[bDevKey].repo_url) ||
                           "https://github.com/" + bName + "/revanced-patches";
            if (isNewBundle) {
                var authorHtml = getAuthorLink(bRepoUrl);
                var bNewVer = (bundlesData[bStableKey] && bundlesData[bStableKey].version) ||
                              (bundlesData[bDevKey] && bundlesData[bDevKey].version) || "";
                var newVerTag = bNewVer ? ' <span class="bundle-version-tag">' + escHtml(bNewVer) + '</span>' : '';
                headerHtml = `
                    <div class="changelog-bundle-header">
                        <span class="badge badge-new-bundle">NEW BUNDLE</span>
                        <span>Bundle <a href="index.html#bundle=${encodeURIComponent(bName)}" class="changelog-bundle-link"><strong>${bName} patches</strong></a>` + newVerTag + ` (${channelsStr}) added by ${authorHtml}</span>
                    </div>
                `;
            } else {
                var bVer = (bundlesData[bStableKey] && bundlesData[bStableKey].version) ||
                           (bundlesData[bDevKey] && bundlesData[bDevKey].version) || "";
                var verTag2 = bVer ? ' <span class="bundle-version-tag">' + escHtml(bVer) + '</span>' : '';
                headerHtml = `
                    <div class="changelog-bundle-header">
                        <span class="badge badge-updated">UPDATED</span>
                        <span>Bundle <a href="index.html#bundle=${encodeURIComponent(bName)}" class="changelog-bundle-link"><strong>${bName} patches</strong></a>` + verTag2 + `</span>
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

            const sortOrder = {"NEW APP": 0, "UPDATED APP": 1, "REMOVED APP": 2};
                bGroup.apps.sort(function(a, b) {
                    return (sortOrder[a.badge_type] ?? 1) - (sortOrder[b.badge_type] ?? 1);
                });

                bGroup.apps.forEach(app => {
                    const badgeHtml = appBadgeMap[app.badge_type] || appBadgeMap["NEW APP"];
                    const isPre = isAppPreRelease(bName, app.package, bundlesData);
                    const preReleaseBadge = isPre ? '<span class="badge badge-pre-release">PRE-RELEASE</span>' : '';
                    const promotedBadge = app.promoted_from ? '<span class="badge badge-promoted">MOVED TO STABLE</span>' : '';
                    const appIconUrl = getAppIconUrl(app);
                    const appIconHtml4 = getAppIconHtml(appIconUrl);
                    const hasPlayStore = !!appIconUrl;
                    const iconLink = hasPlayStore
                        ? `<a href="https://play.google.com/store/apps/details?id=${app.package}" target="_blank" class="app-icon-link">${appIconHtml4}</a>`
                        : appIconHtml4;
                    const scanBadges = (app.scan_numbers || []).map(sn => `<span class="badge badge-scan" title="${sn}${ordinalSuffix(sn)} scan batch">${sn}</span>`).join(' ');
                    const channelsJson = JSON.stringify(bGroup.channels);
                    const patchDiffJson = app.patch_diff ? JSON.stringify(app.patch_diff) : "";
                    const summaryAttr = app.summary ? escHtml(app.summary).replace(/'/g, "&apos;") : "";

                    appsListHtml += `
                        <li class="changelog-item" data-bundle="${bName}" data-package="${app.package}" data-channels='${channelsJson}' data-patch-diff='${patchDiffJson}' data-summary='${summaryAttr}'>
                            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                                ${badgeHtml}
                                ${preReleaseBadge}
                                ${promotedBadge}
                                ${iconLink}
                                <span><strong class="changelog-app-link" role="button" tabindex="0">${escHtml(resolveAppName(app))}</strong> ${scanBadges}</span>
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

        var bundleLinks = card.querySelectorAll(".changelog-bundle-link");
        bundleLinks.forEach(function(link) {
            link.addEventListener("click", function(e) {
                e.preventDefault();
                var bundleName = link.querySelector("strong") ? link.querySelector("strong").textContent.trim() : link.textContent.trim();
                bundleName = bundleName.replace(/ patches$/, "");
                var foundGroup = grouped[bundleName];
                var channels = foundGroup ? foundGroup.channels : [];
                openBundleModal(bundleName, {
                    version: "",
                    channels: channels
                });
            });
        });

        var appLinks = card.querySelectorAll(".changelog-app-link");
        appLinks.forEach(function(link) {
            link.addEventListener("click", function(e) {
                e.preventDefault();
                e.stopPropagation();
                var item = this.closest(".changelog-item");
                if (!item) return;
                var pkg = item.getAttribute("data-package");
                var bundleName = item.getAttribute("data-bundle");
                var channels = JSON.parse(item.getAttribute("data-channels") || "[]");
                var patchDiffStr = item.getAttribute("data-patch-diff");
                var patchDiff = patchDiffStr ? JSON.parse(patchDiffStr) : null;
                var summaryStr = item.getAttribute("data-summary");
                var summary = summaryStr || null;
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
                    openAppModal(appData, { bundle: bundleName, channels: channels, patch_diff: patchDiff, summary: summary });
                }
            });
            link.addEventListener("keydown", function(e) {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    this.click();
                }
            });
        });
    });
}
