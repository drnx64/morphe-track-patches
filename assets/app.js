// Dynamic UI engine
document.addEventListener("DOMContentLoaded", () => {
    const isDashboard = document.getElementById("nav-dashboard") && document.getElementById("nav-dashboard").classList.contains("active");
    const isChangelog = document.getElementById("nav-changelog") && document.getElementById("nav-changelog").classList.contains("active");
    
    if (isDashboard) {
        initDashboard();
    } else if (isChangelog) {
        initChangelog();
    }
});

// Format timestamp cleanly
function formatTime(isoStr) {
    if (!isoStr) return "-";
    try {
        const d = new Date(isoStr);
        return d.toLocaleString();
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

// Check if an app is pre-release (supported in dev but not in stable for a bundle)
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
let currentFilters = {
    search: "",
    channel: "all"
};

function initDashboard() {
    console.log("Initializing Dashboard...");
    
    fetch("data/live.json")
        .then(res => {
            if (!res.ok) throw new Error("Status " + res.status);
            return res.json();
        })
        .then(data => {
            renderStats(data);
            
            // Enrich bundles data with key
            allBundlesData = {};
            for (const [key, b] of Object.entries(data.bundles || {})) {
                allBundlesData[key] = {
                    ...b,
                    key: key
                };
            }
            
            renderTodayUpdates(data);
            setupDashboardFilters();
            filterAndRenderBundles();
        })
        .catch(err => {
            console.error("Error loading live.json:", err);
            const container = document.getElementById("bundles-grid-container");
            if (container) {
                container.innerHTML = `<div class="error-state">Failed to load dashboard data: ${err.message}. Ensure data/live.json exists.</div>`;
            }
        });
}

function renderStats(data) {
    document.getElementById("stat-total-bundles").textContent = data.stats?.total_bundles ?? 0;
    document.getElementById("stat-total-apps").textContent = data.stats?.total_apps ?? 0;
    document.getElementById("stat-new-apps-today").textContent = data.stats?.new_apps_today ?? 0;
    document.getElementById("stat-new-bundles-today").textContent = data.stats?.new_bundles_today ?? 0;
    document.getElementById("val-last-checked").textContent = formatTime(data.last_run);
}

function renderTodayUpdates(data) {
    const updatesLabel = document.getElementById("updates-date-label");
    const container = document.getElementById("today-updates-container");
    if (!container) return;
    
    updatesLabel.textContent = `Updated: ${formatFriendlyDate(data.date)}`;
    
    const changes = data.changes || {};
    const newBundles = changes.new_bundles || [];
    const newApps = changes.new_apps || [];
    
    if (newBundles.length === 0 && newApps.length === 0) {
        container.innerHTML = `<div class="no-updates-msg">No compatibility changes detected in the latest update scan. All active patches match the current catalog.</div>`;
        return;
    }
    
    container.innerHTML = "";
    
    // Group updates by base bundle name
    const grouped = {};
    
    newBundles.forEach(b => {
        const bName = b.bundle;
        if (!grouped[bName]) {
            grouped[bName] = {
                bundle: bName,
                newChannels: [],
                apps: []
            };
        }
        if (!grouped[bName].newChannels.includes(b.channel)) {
            grouped[bName].newChannels.push(b.channel);
        }
    });
    
    newApps.forEach(app => {
        const bName = app.bundle.split(':')[0];
        if (!grouped[bName]) {
            grouped[bName] = {
                bundle: bName,
                newChannels: [],
                apps: []
            };
        }
        
        // Deduplicate app by package name
        const pkg = app.package;
        const exists = grouped[bName].apps.some(a => a.package === pkg);
        if (!exists) {
            grouped[bName].apps.push(app);
        }
    });
    
    const sortedBundleNames = Object.keys(grouped).sort();
    
    sortedBundleNames.forEach(bName => {
        const bGroup = grouped[bName];
        const isNewBundle = bGroup.newChannels.length > 0;
        
        const bundleRow = document.createElement("div");
        bundleRow.className = "update-row";
        
        if (isNewBundle) {
            // Find repo url to link author
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
            const channelsStr = bGroup.newChannels.join(", ");
            
            bundleRow.innerHTML = `
                <span class="badge badge-new-bundle">NEW BUNDLE</span>
                <span>Bundle <strong>${bName}</strong> (${channelsStr}) added by ${authorHtml}</span>
            `;
        } else {
            bundleRow.innerHTML = `
                <span>Bundle <strong>${bName}</strong> patches</span>
            `;
        }
        
        if (bGroup.apps.length > 0) {
            const appsContainer = document.createElement("div");
            appsContainer.className = "update-bundle-apps";
            
            const statusBadges = {
                "new": '<span class="badge badge-new">NEW APP</span>',
                "updated": '<span class="badge badge-updated">UPDATED APP</span>',
                "removed": '<span class="badge badge-removed">REMOVED APP</span>'
            };
            
            bGroup.apps.forEach(app => {
                const status = app.status || "new";
                const isPre = isAppPreRelease(bName, app.package, data.bundles);
                const preReleaseBadge = isPre ? '<span class="badge badge-pre-release">PRE-RELEASE</span>' : '';
                const badgeHtml = statusBadges[status] || statusBadges["new"];
                const playLink = `<a href="https://play.google.com/store/apps/details?id=${app.package}" target="_blank" class="app-play-link">${app.app_name}</a>`;
                
                const appRow = document.createElement("div");
                appRow.className = "update-row";
                appRow.innerHTML = `
                    ${badgeHtml}
                    ${preReleaseBadge}
                    <span><strong class="highlight-app">${playLink}</strong> (<span class="app-pkg-label">${app.package}</span>) in ${bName} patches</span>
                `;
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
    
    // Channel buttons
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
    const container = document.getElementById("bundles-grid-container");
    if (!container) return;
    
    // Group all bundles by bundle name to merge channels and remove duplicates
    const grouped = {};
    Object.values(allBundlesData).forEach(b => {
        // Apply Channel Filter if selected (not "all")
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
            // Merge channel
            if (!grouped[name].channels.includes(b.channel)) {
                grouped[name].channels.push(b.channel);
            }
            // Merge apps (deduplicate by package)
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
    
    // Apply Search Filter (app name, package name, or bundle name)
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
    }
    
    // Sort logic: priority list first, then by number of apps patched (descending), then alphabetical
    list.sort((a, b) => {
        const orderList = ["morphe", "piko", "rookieenough", "hoo-dles", "paresh-maheshwari", "brosssh", "patcheddit"];
        
        const aIndex = orderList.indexOf(a.bundle);
        const bIndex = orderList.indexOf(b.bundle);
        
        if (aIndex !== -1 && bIndex !== -1) {
            return aIndex - bIndex;
        }
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        
        // Neither is in the priority list, sort by number of apps patched (descending)
        const aCount = a.apps ? a.apps.length : 0;
        const bCount = b.apps ? b.apps.length : 0;
        if (bCount !== aCount) {
            return bCount - aCount;
        }
        // Fallback to alphabetical by bundle name
        return a.bundle.localeCompare(b.bundle);
    });
    
    if (list.length === 0) {
        container.innerHTML = '<div class="loading-state">No matching Morphe bundles found.</div>';
        return;
    }
    
    container.innerHTML = "";
    list.forEach(b => {
        const card = document.createElement("div");
        card.className = "bundle-card expanded";

        const apps = b.apps || [];
        const count = apps.length;
        const appsWord = count === 1 ? "app" : "apps";

        // Sort apps alphabetically
        apps.sort((x, y) => x.app_name.localeCompare(y.app_name));

        const repoInfo = getRepoInfo(b.repo_url);
        const param = repoInfo.isGitLab ? "gitlab" : "github";
        const addMorpheUrl = `https://morphe.software/add-source?${param}=${encodeURIComponent(repoInfo.path)}`;

        const iconSvg = repoInfo.isGitLab ? `
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M23.957 12.355l-2.316-7.13a.9.9 0 0 0-.309-.434.908.908 0 0 0-.534-.143.91.91 0 0 0-.528.163.906.906 0 0 0-.294.417L17.7 12.355H6.3L4.024 5.228a.9.9 0 0 0-.295-.417.913.913 0 0 0-.53-.163.906.906 0 0 0-.533.143.904.904 0 0 0-.308.434l-2.316 7.13a.593.593 0 0 0 .218.675l10.963 7.97a1.32 1.32 0 0 0 1.554 0l10.963-7.97a.593.593 0 0 0 .218-.675z"/>
            </svg>
        ` : `
            <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
            </svg>
        `;

        let badgesHtml = "";
        b.channels.forEach(ch => {
            badgesHtml += `<span class="channel-badge ${ch}">${ch}</span>`;
        });

        // Build the app list rows
        let appItemsHtml = "";
        apps.forEach(app => {
            const isPre = isAppPreRelease(b.bundle, app.package, allBundlesData);
            const preTag = isPre ? `<span class="badge badge-pre-release" style="margin-left:4px">Pre-Release</span>` : "";
            appItemsHtml += `
                <div class="app-item">
                    <span class="app-name-label">
                        <a href="https://play.google.com/store/apps/details?id=${app.package}"
                           target="_blank" class="app-play-link"
                           onclick="event.stopPropagation()">${app.app_name}</a>${preTag}
                    </span>
                    <span class="app-pkg-label">${app.package}</span>
                </div>`;
        });

        card.innerHTML = `
            <div class="bundle-card-header">
                <div class="bundle-title-group">
                    <span class="bundle-name-title" title="${b.bundle}">${b.bundle}</span>
                    <div class="channel-badges-group">${badgesHtml}</div>
                </div>
                <a href="${b.repo_url}" class="github-repo-icon-link" target="_blank"
                   title="View Source Repository" onclick="event.stopPropagation()">
                    ${iconSvg}
                </a>
            </div>
            <div class="apps-summary">${count} compatible ${appsWord}</div>
            <div class="apps-list-drawer">
                <div class="apps-list">${appItemsHtml}</div>
            </div>
            <a href="${addMorpheUrl}" class="add-morphe-btn" target="_blank"
               onclick="event.stopPropagation()">Add to Morphe</a>
        `;

        // Expand/collapse the app drawer on card click
        card.addEventListener("click", () => {
            card.classList.toggle("expanded");
        });

        container.appendChild(card);
    });
}

        const iconSvg = repoInfo.isGitLab ? `
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M23.957 12.355l-2.316-7.13a.9.9 0 0 0-.309-.434.908.908 0 0 0-.534-.143.91.91 0 0 0-.528.163.906.906 0 0 0-.294.417L17.7 12.355H6.3L4.024 5.228a.9.9 0 0 0-.295-.417.913.913 0 0 0-.53-.163.906.906 0 0 0-.533.143.904.904 0 0 0-.308.434l-2.316 7.13a.593.593 0 0 0 .218.675l10.963 7.97a1.32 1.32 0 0 0 1.554 0l10.963-7.97a.593.593 0 0 0 .218-.675z"/>
            </svg>
        ` : `
            <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
            </svg>
        `;

        let badgesHtml = "";
        b.channels.forEach(ch => {
            badgesHtml += `<span class="channel-badge ${ch}">${ch}</span>`;
        });

        // Build app tabs and panels
        let tabsHtml = "";
        let panelsHtml = "";

        apps.forEach((app, idx) => {
            const isPre = isAppPreRelease(b.bundle, app.package, allBundlesData);
            const safeId = `${b.bundle}-${app.package}`.replace(/[^a-z0-9]/gi, "_");
            const isFirst = idx === 0;
            const preTag = isPre ? `<span class="patch-off-badge" style="margin-left:4px">Pre</span>` : "";

            tabsHtml += `<button class="app-tab-btn${isFirst ? " active" : ""}" data-tab="${safeId}" onclick="event.stopPropagation()">${app.app_name}${preTag}</button>`;

            // Build version chips
            const patchList = app.patches || [];
            const allVersions = new Set();
            patchList.forEach(p => {
                if (p.compatible_versions && p.compatible_versions.length > 0) {
                    p.compatible_versions.forEach(v => allVersions.add(v));
                }
            });
            const versionArr = [...allVersions].sort();
            const anyVersion = versionArr.length === 0;

            let versionsHtml = `<span class="versions-label">Versions:</span>`;
            if (anyVersion) {
                versionsHtml += `<span class="version-chip any">Any</span>`;
            } else {
                versionArr.slice(0, 6).forEach(v => {
                    versionsHtml += `<span class="version-chip">${v}</span>`;
                });
                if (versionArr.length > 6) {
                    versionsHtml += `<span class="version-chip any">+${versionArr.length - 6} more</span>`;
                }
            }

            // Build patch items
            let patchItemsHtml = "";
            if (patchList.length === 0) {
                patchItemsHtml = `<div style="font-size:0.8rem;color:var(--text-secondary);padding:0.5rem 0;">No patch details available.</div>`;
            } else {
                patchList.forEach((patch, pi) => {
                    const patchId = `${safeId}_p${pi}`;
                    const isOff = patch.use === false;
                    const offTag = isOff ? `<span class="patch-off-badge">Off by default</span>` : "";
                    const desc = patch.description ? patch.description : "";

                    // Build options sub-list
                    let optHtml = "";
                    if (patch.options && patch.options.length > 0) {
                        patch.options.forEach(opt => {
                            optHtml += `
                                <div>
                                    <div class="patch-option-key">${opt.key}</div>
                                    <div class="patch-option-desc">${opt.description || ""}</div>
                                </div>`;
                        });
                        optHtml = `<div class="patch-options">${optHtml}</div>`;
                    }

                    const hasMore = desc.length > 80 || patch.options?.length > 0;
                    const expandHint = hasMore ? `
                        <span class="patch-expand-hint">
                            <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor"><path d="M8 11L1 4h14z"/></svg>
                            ${patch.options?.length ? patch.options.length + " option" + (patch.options.length > 1 ? "s" : "") : "More"}
                        </span>` : "";

                    patchItemsHtml += `
                        <div class="patch-item" data-patch-id="${patchId}" onclick="togglePatch(event,'${patchId}')">
                            <div class="patch-item-header">
                                <span class="patch-name">${patch.name}</span>
                                ${offTag}
                            </div>
                            ${desc ? `<div class="patch-desc">${desc}</div>` : ""}
                            ${optHtml}
                            ${expandHint}
                        </div>`;
                });
            }

            panelsHtml += `
                <div class="app-panel${isFirst ? " active" : ""}" data-panel="${safeId}">
                    <div class="app-panel-meta">
                        <a href="https://play.google.com/store/apps/details?id=${app.package}" target="_blank" class="app-pkg-link" onclick="event.stopPropagation()">${app.package}</a>
                        ${isPre ? '<span class="badge badge-pre-release">Pre-Release</span>' : ""}
                    </div>
                    <div class="versions-row">${versionsHtml}</div>
                    <div class="patches-list">${patchItemsHtml}</div>
                </div>`;
        });

        const drawerContent = apps.length > 0
            ? `<div class="app-tabs-row">${tabsHtml}</div>${panelsHtml}`
            : `<div style="font-size:0.82rem;color:var(--text-secondary);">No app info available.</div>`;

        card.innerHTML = `
            <div class="bundle-card-header">
                <div class="bundle-title-group">
                    <span class="bundle-name-title" title="${b.bundle}">${b.bundle}</span>
                    <div class="channel-badges-group">${badgesHtml}</div>
                </div>
                <a href="${b.repo_url}" class="github-repo-icon-link" target="_blank" title="View Source Repository" onclick="event.stopPropagation()">
                    ${iconSvg}
                </a>
            </div>
            <div class="apps-summary">${count} compatible ${appsWord}</div>
            <div class="apps-list-drawer">${drawerContent}</div>
            <a href="${addMorpheUrl}" class="add-morphe-btn" target="_blank" onclick="event.stopPropagation()">
                Add to Morphe
            </a>
        `;

        // Tab switching (scoped to this card)
        card.querySelectorAll(".app-tab-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const targetPanel = btn.getAttribute("data-tab");
                card.querySelectorAll(".app-tab-btn").forEach(b2 => b2.classList.remove("active"));
                card.querySelectorAll(".app-panel").forEach(p => p.classList.remove("active"));
                btn.classList.add("active");
                const panel = card.querySelector(`.app-panel[data-panel="${targetPanel}"]`);
                if (panel) panel.classList.add("active");
            });
        });

        // Expand/collapse on card body click (not on interactive children)
        card.addEventListener("click", () => {
            card.classList.toggle("expanded");
        });

        container.appendChild(card);
    });
}

function togglePatch(event, patchId) {
    event.stopPropagation();
    const item = document.querySelector(`.patch-item[data-patch-id="${patchId}"]`);
    if (item) item.classList.toggle("expanded");
}

function initChangelog() {
    console.log("Initializing Changelog...");
    
    Promise.all([
        fetch("data/changelog.json").then(res => {
            if (!res.ok) throw new Error("Changelog status " + res.status);
            return res.json();
        }),
        fetch("data/live.json").then(res => {
            if (!res.ok) throw new Error("Live status " + res.status);
            return res.json();
        })
    ])
    .then(([changelog, liveData]) => {
        renderChangelog(changelog, liveData.bundles);
    })
    .catch(err => {
        console.error("Error loading changelog data:", err);
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
        
        // Group updates by base bundle name
        const grouped = {};
        const newBundles = day.new_bundles || [];
        const newApps = day.new_apps || [];
        
        newBundles.forEach(b => {
            const bName = b.bundle;
            if (!grouped[bName]) {
                grouped[bName] = {
                    bundle: bName,
                    newChannels: [],
                    apps: []
                };
            }
            if (!grouped[bName].newChannels.includes(b.channel)) {
                grouped[bName].newChannels.push(b.channel);
            }
        });
        
        newApps.forEach(app => {
            const bName = app.bundle.split(':')[0];
            if (!grouped[bName]) {
                grouped[bName] = {
                    bundle: bName,
                    newChannels: [],
                    apps: []
                };
            }
            const pkg = app.package;
            const exists = grouped[bName].apps.some(a => a.package === pkg);
            if (!exists) {
                grouped[bName].apps.push(app);
            }
        });
        
        const sortedBundleNames = Object.keys(grouped).sort();
        let dayHtml = "";
        
        sortedBundleNames.forEach(bName => {
            const bGroup = grouped[bName];
            const isNewBundle = bGroup.newChannels.length > 0;
            
            let headerHtml = "";
            if (isNewBundle) {
                const channelsStr = bGroup.newChannels.join(", ");
                headerHtml = `
                    <div class="changelog-bundle-header">
                        <span class="badge badge-new-bundle">NEW BUNDLE</span>
                        <span>Bundle <strong>${bName}</strong> (${channelsStr})</span>
                    </div>
                `;
            } else {
                headerHtml = `
                    <div class="changelog-bundle-header">
                        <span>Bundle <strong>${bName}</strong> patches</span>
                    </div>
                `;
            }
            
            let appsListHtml = "";
            if (bGroup.apps.length > 0) {
                appsListHtml += `<ul class="changelog-bundle-apps">`;
                
                const statusBadges = {
                    "new": '<span class="badge badge-new">NEW APP</span>',
                    "updated": '<span class="badge badge-updated">UPDATED APP</span>',
                    "removed": '<span class="badge badge-removed">REMOVED APP</span>'
                };
                
                bGroup.apps.forEach(app => {
                    const status = app.status || "new";
                    const isPre = isAppPreRelease(bName, app.package, bundlesData);
                    const preReleaseBadge = isPre ? '<span class="badge badge-pre-release">PRE-RELEASE</span>' : '';
                    const badgeHtml = statusBadges[status] || statusBadges["new"];
                    const playLink = `<a href="https://play.google.com/store/apps/details?id=${app.package}" target="_blank" class="app-play-link">${app.app_name}</a>`;
                    
                    appsListHtml += `
                        <li class="changelog-item">
                            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                                ${badgeHtml}
                                ${preReleaseBadge}
                                <span><strong class="highlight-app">${playLink}</strong> (<span class="app-pkg-label">${app.package}</span>) in ${bName} patches</span>
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
