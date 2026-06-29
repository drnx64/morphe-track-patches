var modalState = {};
var _bundleWasOpen = false;

function openAppModal(app, bundle) {
    const modal = document.getElementById("app-detail-modal");
    if (!modal) return;
    log("openAppModal", "app=" + (app.app_name || app.package) + " bundle=" + (bundle && bundle.bundle) + " patches=" + (app.patches || []).length);

    _bundleWasOpen = false;
    var bundleModal = document.getElementById("bundle-detail-modal");
    if (bundleModal && bundleModal.classList.contains("open")) {
        _bundleWasOpen = true;
        bundleModal.classList.remove("open");
    }

    const modalIconHtml = getAppIconHtml(getAppIconUrl(app), "app-icon app-icon-modal");
    document.getElementById("modal-app-name").innerHTML = modalIconHtml + escHtml(resolveAppName(app));

    const pkgLink = document.getElementById("modal-pkg-link");
    pkgLink.textContent = app.package;
    pkgLink.href = "https://play.google.com/store/apps/details?id=" + encodeURIComponent(app.package);

    const playBtn = document.getElementById("modal-play-btn");
    playBtn.href = "https://play.google.com/store/apps/details?id=" + encodeURIComponent(app.package);

    document.getElementById("modal-bundle-info").textContent = "in " + bundle.bundle;

    const channelRow = document.getElementById("modal-channel-row");
    channelRow.innerHTML = bundle.channels.map(ch =>
        '<span class="channel-badge ' + ch + '">' + ch + '</span>'
    ).join('');

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

    var stableBtn = document.querySelector('.channel-toggle-btn[data-channel="stable"]');
    var devBtn = document.querySelector('.channel-toggle-btn[data-channel="dev"]');
    if (stableBtn) stableBtn.style.display = stableAppData ? "" : "none";
    if (devBtn) devBtn.style.display = devAppData ? "" : "none";

    var defaultChannel = "stable";
    if (!stableAppData && devAppData) defaultChannel = "dev";

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

    toggleBtns.forEach(function(b) { b.classList.remove("active"); });
    var activeBtn = document.querySelector('.channel-toggle-btn[data-channel="' + defaultChannel + '"]');
    if (activeBtn) activeBtn.classList.add("active");
    modalState.currentChannel = defaultChannel;
    renderModalChannel();

    modal.classList.add("open");
    document.body.style.overflow = "hidden";

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

    const count = showPatches.length;
    document.getElementById("modal-patches-count").textContent =
        count + " patch" + (count !== 1 ? "es" : "");

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

function openBundleModal(bundleName, bundleData) {
    const modal = document.getElementById("bundle-detail-modal");
    if (!modal) return;
    log("openBundleModal", "bundle=" + bundleName + " stable=" + (allBundlesData[bundleName+":stable"] ? "found" : "missing") + " dev=" + (allBundlesData[bundleName+":dev"] ? "found" : "missing") + " allBundlesData keys=" + Object.keys(allBundlesData).length);

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

    var histBtn = document.getElementById("bundle-modal-history-btn");
    if (histBtn) {
        histBtn.onclick = null;
        histBtn.addEventListener("click", function(e) {
            e.stopPropagation();
            closeBundleModal();
            openBundleHistory(bundleName);
        });
    }

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

function openBundleHistory(bundleName) {
    var modal = document.getElementById("bundle-history-modal");
    if (!modal) return;

    document.getElementById("bundle-history-title").textContent = bundleName + " patches";
    document.getElementById("bundle-history-subtitle").textContent = "Releases & update history";

    var listEl = document.getElementById("bundle-history-list");

    modal.classList.add("open");
    document.body.style.overflow = "hidden";

    Promise.all([idbGet(CACHE_KEYS.LIVE), idbGet(CACHE_KEYS.CHANGELOG), idbGet(CACHE_KEYS.RELEASE_CACHE)]).then(function(cached) {
        if (cached[0] && cached[1]) {
            renderBundleHistory(bundleName, cached[0], cached[1], "", cached[2] || null);
        } else {
            listEl.innerHTML = '<div class="loading-state">Loading history...</div>';
        }
    });

    Promise.all([
        fetchAllData(),
        fetch("data/changelog.json?_t=" + Date.now()).then(function(r) { if (!r.ok) throw new Error("Status " + r.status); return r.json(); }),
        fetch("data/state/release_cache.json?_t=" + Date.now()).then(function(r) { return r.ok ? r.json() : {}; }).catch(function() { return {}; })
    ])
    .then(function(items) {
        if (items[0] && items[1]) {
            idbSet(CACHE_KEYS.LIVE, items[0]);
            idbSet(CACHE_KEYS.CHANGELOG, items[1]);
        }
        if (items[2] && typeof items[2] === 'object' && Object.keys(items[2]).length > 0) {
            idbSet(CACHE_KEYS.RELEASE_CACHE, items[2]);
        }
        renderBundleHistory(bundleName, items[0], items[1], "", items[2]);
    })
    .catch(function() {
        if (!listEl.querySelector(".bundle-release-card")) {
            listEl.innerHTML = '<div class="loading-state">Failed to load history. Check your connection.</div>';
        }
    });
}

var _historyBundleName = "";
var _historyLiveData = null;
var _historyChangelog = null;
var _historyChannel = "";

function renderBundleHistory(bundleName, liveData, changelog, channel, releaseCache) {
    var container = document.getElementById("bundle-history-list");
    if (!container) return;

    _historyBundleName = bundleName;
    _historyLiveData = liveData;
    _historyChangelog = changelog;

    container.innerHTML = "";

    var stableKey = bundleName + ":stable";
    var devKey = bundleName + ":dev";
    var stableBundle = liveData && liveData.bundles && liveData.bundles[stableKey];
    var devBundle = liveData && liveData.bundles && liveData.bundles[devKey];

    var hasStable = stableBundle && stableBundle.version;
    var hasDev = devBundle && devBundle.version;

    var showStable = hasStable;
    var showDev = hasDev;
    if (hasStable && hasDev) {
        if (stableBundle.version === devBundle.version) {
            showStable = false;
        } else if (compareVersions(stableBundle.version, devBundle.version) >= 0) {
            showDev = false;
        }
    }

    var defaultChannel = channel || "";
    if (!defaultChannel) {
        if (showDev) {
            defaultChannel = "dev";
        } else {
            defaultChannel = "stable";
        }
    }
    _historyChannel = defaultChannel;

    var currentBundle = defaultChannel === "dev" ? devBundle : stableBundle;
    var repoUrl = currentBundle && currentBundle.repo_url || "";

    if (currentBundle && currentBundle.version) {
        var releaseCard = document.createElement("div");
        releaseCard.className = "bundle-release-card";
        var repoInfo = getRepoInfo(repoUrl);
        var isGitLab = repoInfo.isGitLab;
        var releasesUrl = repoInfo.path
            ? (isGitLab
                ? "https://gitlab.com/" + repoInfo.path + "/-/releases"
                : "https://github.com/" + repoInfo.path + "/releases")
            : "";

        var channels = [];
        if (showStable) channels.push("stable");
        if (showDev) channels.push("dev");

        var channelsHtml = channels.map(function(ch) {
            return '<span class="channel-badge ' + ch + '">' + ch + '</span>';
        }).join(' ');

        var toggleHtml = "";
        if (showStable && showDev) {
            toggleHtml = '<div class="history-channel-toggle">' +
                '<button class="channel-toggle-btn' + (defaultChannel === "stable" ? " active" : "") + '" data-hchannel="stable">Stable</button>' +
                '<button class="channel-toggle-btn' + (defaultChannel === "dev" ? " active" : "") + '" data-hchannel="dev">Dev</button>' +
                '</div>';
        }

        var releaseDate = currentBundle.release_date || "";
        var dateHtml = releaseDate
            ? '<div class="bundle-release-date">Released ' + formatTime(releaseDate) + '</div>'
            : '';

        var releaseBody = currentBundle.release_notes || "";
        if (!releaseBody && releaseCache && repoUrl) {
            var repoRels = releaseCache[repoUrl];
            if (repoRels && repoRels.releases && repoRels.releases.length > 0) {
                var matchTag = (currentBundle.release_tag || currentBundle.version || "").toLowerCase().replace(/^v/, '');
                for (var ri = 0; ri < repoRels.releases.length; ri++) {
                    var tagClean = (repoRels.releases[ri].tag || "").toLowerCase().replace(/^v/, '');
                    if (tagClean === matchTag) {
                        releaseBody = repoRels.releases[ri].body || "";
                        break;
                    }
                }
                if (!releaseBody) releaseBody = repoRels.releases[0].body || "";
            }
        }
        var notesHtml = '';
        if (releaseBody) {
            var cleanBody = stripVersionHeader(releaseBody);
            var parsed = parseReleaseNotes(cleanBody);
            notesHtml = parsed.length > 0
                ? '<div class="bundle-release-desc" style="margin-top:0.5rem">' + renderReleaseSections(parsed) + '</div>'
                : '<div class="bundle-release-desc bundle-release-desc--empty" style="margin-top:0.5rem">No details.</div>';
        }

        releaseCard.innerHTML = [
            toggleHtml,
            '<div class="bundle-release-header">',
            '  <span class="bundle-release-version">' + escHtml(currentBundle.version) + '</span>',
            '  <span class="bundle-release-badges">' + channelsHtml + '</span>',
            '</div>',
            dateHtml,
            notesHtml,
            releasesUrl ? '<a href="' + escHtml(releasesUrl) + '" target="_blank" class="bundle-release-link">View all releases' + (isGitLab ? ' on GitLab' : ' on GitHub') + ' \u2192</a>' : ''
        ].join('');
        container.appendChild(releaseCard);

        var toggleBtns = releaseCard.querySelectorAll(".channel-toggle-btn");
        toggleBtns.forEach(function(btn) {
            btn.addEventListener("click", function() {
                var ch = this.getAttribute("data-hchannel");
                if (ch === _historyChannel) return;
                renderBundleHistory(bundleName, liveData, changelog, ch, releaseCache);
            });
        });
    }

    var entriesMap = {};

    if (changelog) {
        changelog.forEach(function(day) {
            var matching = (day.affected_bundles || []).filter(function(b) { return b.bundle === bundleName; });
            if (matching.length > 0) {
                var key = day.date;
                if (!entriesMap[key]) entriesMap[key] = { date: day.date, bundles: [] };
                entriesMap[key].bundles = entriesMap[key].bundles.concat(matching);
            }
        });
    }

    if (releaseCache && repoUrl) {
        var repoReleases = releaseCache[repoUrl];
        if (repoReleases && repoReleases.releases) {
            repoReleases.releases.forEach(function(rl) {
                if (!rl.dateReleased) return;
                var dateKey = rl.dateReleased.split('T')[0];
                if (!entriesMap[dateKey]) entriesMap[dateKey] = { date: dateKey, bundles: [] };
                entriesMap[dateKey].bundles.push({
                    badge_type: "RELEASE",
                    channel: rl.prerelease ? "dev" : "stable",
                    version: rl.tag,
                    body: rl.body,
                    isCurrent: rl.tag === (currentBundle && currentBundle.release_tag || "")
                });
            });
        }
    }

    var entries = Object.values(entriesMap).sort(function(a, b) { return b.date.localeCompare(a.date); });

    if (entries.length === 0) {
        return;
    }

    var histHeader = document.createElement("div");
    histHeader.className = "bundle-history-section-header";
    histHeader.textContent = "Update history";
    container.appendChild(histHeader);

    entries.forEach(function(entry) {
        var dayCard = document.createElement("div");
        dayCard.className = "changelog-day-card";

        var dayHtml = '<div class="changelog-date-header">' + formatFriendlyDate(entry.date) + '</div>';

        entry.bundles.forEach(function(b) {
            if (b.badge_type === "RELEASE") {
                var badgeHtml = b.isCurrent
                    ? '<span class="badge" style="background:#22c55e;color:#fff">CURRENT</span>'
                    : '<span class="badge badge-updated">RELEASE</span>';
                var channelBadge = b.channel === "dev"
                    ? '<span class="channel-badge dev">dev</span>'
                    : '<span class="channel-badge stable">stable</span>';
                var versionBadge = '<span class="badge-version">' + escHtml(b.version) + '</span>';
                dayHtml += '<div class="changelog-bundle-header">' + badgeHtml + ' ' + versionBadge + ' ' + channelBadge + '</div>';
                if (b.body && !b.isCurrent) {
                    var cleanBody = stripVersionHeader(b.body);
                    var parsed = parseReleaseNotes(cleanBody);
                    dayHtml += parsed.length > 0
                        ? '<div class="bundle-release-desc">' + renderReleaseSections(parsed) + '</div>'
                        : '<div class="bundle-release-desc bundle-release-desc--empty">No details.</div>';
                }
            } else {
                var isNew = b.badge_type === "NEW BUNDLE";
                var badgeHtml = isNew
                    ? '<span class="badge badge-new-bundle">NEW BUNDLE</span>'
                    : '<span class="badge badge-updated">UPDATED</span>';
                var channelsStr = b.channels || b.channel || "";
                dayHtml += '<div class="changelog-bundle-header">' + badgeHtml + ' <span>Channel: ' + channelsStr + '</span></div>';

                if (b.apps && b.apps.length > 0) {
                    dayHtml += '<ul class="changelog-bundle-apps">';
                    b.apps.forEach(function(app) {
                        var appBadgeMap = {
                            "NEW APP": '<span class="badge badge-new">NEW APP</span>',
                            "UPDATED APP": '<span class="badge badge-updated">UPDATED APP</span>',
                            "REMOVED APP": '<span class="badge badge-removed">REMOVED APP</span>'
                        };
                        var ab = appBadgeMap[app.badge_type] || '<span class="badge badge-new">NEW APP</span>';
                        var icon = getAppIconHtml(getAppIconUrl(app));
                        var scanBadges = (app.scan_numbers || []).map(function(sn) {
                            return '<span class="badge badge-scan" title="' + sn + ordinalSuffix(sn) + ' scan batch">' + sn + '</span>';
                        }).join(' ');
                        dayHtml += '<li class="changelog-item"><div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">' + ab + ' ' + icon + ' <span><strong>' + escHtml(resolveAppName(app)) + '</strong> ' + scanBadges + '</span></div></li>';
                    });
                    dayHtml += '</ul>';
                }
            }
        });

        dayCard.innerHTML = dayHtml;
        container.appendChild(dayCard);
    });
}

function closeBundleHistory() {
    var modal = document.getElementById("bundle-history-modal");
    if (!modal) return;
    modal.classList.remove("open");
    document.body.style.overflow = "";
}
