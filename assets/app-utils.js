var VERBOSE = localStorage.getItem("morphe_verbose") !== "0";
if (VERBOSE) console.log("[MorpheTracker] Verbose logging ENABLED. Set localStorage.morphe_verbose=0 to disable.");
window.logtrue123 = function() { VERBOSE = true; localStorage.setItem("morphe_verbose", "1"); console.log("[MorpheTracker] Verbose ENABLED"); };

function log(area, msg) {
    if (!VERBOSE) return;
    console.log("[MorpheTracker:" + area + "]", msg);
}

function setVerbose(on) {
    VERBOSE = !!on;
    localStorage.setItem("morphe_verbose", VERBOSE ? "1" : "0");
    console.log("[MorpheTracker] Verbose logging " + (VERBOSE ? "ENABLED" : "DISABLED"));
}

var CACHE_KEYS = {
    LIVE: 'live',
    CHANGELOG: 'changelog',
    RELEASE_CACHE: 'release_cache',
    ICONS: 'icons',
    NAMES: 'names'
};

function ordinalSuffix(n) {
    var s = ['th', 'st', 'nd', 'rd'];
    var v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
}

function formatTime(isoStr) {
    if (!isoStr) return "-";
    try {
        const d = new Date(isoStr);
        const date = new Intl.DateTimeFormat("en-US", {
            month: "long", day: "numeric", year: "numeric"
        }).format(d);
        const time = new Intl.DateTimeFormat("en-US", {
            hour: "numeric", minute: "2-digit", hour12: true
        }).format(d);
        return `${date} at ${time}`;
    } catch(e) {
        return isoStr;
    }
}

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

function padNum(n) {
    return n < 10 ? "0" + n : "" + n;
}

function getNextScanTime() {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMin = now.getUTCMinutes();
    const slot = Math.floor(utcHour / 3) * 3;
    let nextHour = slot + 3;
    if (utcMin < 1 && utcHour === slot) {
        nextHour = slot;
    }
    const next = new Date(now);
    if (nextHour >= 24) {
        next.setUTCDate(next.getUTCDate() + 1);
        next.setUTCHours(0, 1, 0, 0);
    } else {
        next.setUTCHours(nextHour, 1, 0, 0);
    }
    if (next <= now) {
        next.setUTCDate(next.getUTCDate() + 1);
        next.setUTCHours(0, 1, 0, 0);
    }
    return next;
}

function getScanBatch() {
    return Math.floor(new Date().getUTCHours() / 3) + 1;
}

function getTimeAgo(isoStr) {
    if (!isoStr) return "-";
    try {
        const then = new Date(isoStr);
        const now = new Date();
        const diffMs = now - then;
        if (diffMs < 0) return "just now";
        const diffMin = Math.floor(diffMs / 60000);
        if (diffMin < 1) return "just now";
        if (diffMin < 60) return diffMin + "m ago";
        const diffHrs = Math.floor(diffMin / 60);
        const remainMin = diffMin % 60;
        if (diffHrs < 24) return diffHrs + "h " + remainMin + "m ago";
        const diffDays = Math.floor(diffHrs / 24);
        return diffDays + "d ago";
    } catch(e) {
        return "-";
    }
}

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

var allBundlesData = {};
var iconCache = {};
var nameCache = {};
var currentFilters = {
    search: "",
    channel: "all"
};
var cachedLastRun = "";
var liveDataDate = "";
var scanTimerInterval = null;
var currentView = localStorage.getItem("morphe_view") || "grid";

var cachedLastCheckedOverride = "";

function resolveAppName(app) {
    var n = nameCache[app.package];
    if (typeof n === "string" && n) return n;
    return app.app_name;
}

function getRepoInfo(repoUrl) {
    if (!repoUrl) return { isGitLab: false, path: "" };
    const isGitLab = repoUrl.includes("gitlab.com");
    var path = "";
    if (isGitLab) {
        const m = repoUrl.match(/https:\/\/gitlab\.com\/(.+)/);
        if (m) path = m[1].replace(/\.git$/, "").replace(/\/+$/, "");
    } else {
        const m = repoUrl.match(/https:\/\/github\.com\/([^/]+\/[^/]+)/);
        if (m) path = m[1].replace(/\.git$/, "");
    }
    return { isGitLab, path };
}

function getAppIconUrl(app) {
    if (!app) return "";
    const url = app.icon_url || iconCache[app.package] || "";
    if (typeof url === "string") return url;
    return "";
}

function getAppIconHtml(iconUrl, sizeClass) {
    if (!iconUrl) return "";
    sizeClass = sizeClass || "app-icon";
    return '<img class="' + sizeClass + '" src="' + iconUrl + '" alt="" loading="lazy" onerror="this.remove()">';
}

function escHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

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

const githubSvg = '<svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>';

const gitlabSvg = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M23.957 12.355l-2.316-7.13a.9.9 0 0 0-.309-.434.908.908 0 0 0-.534-.143.91.91 0 0 0-.528.163.906.906 0 0 0-.294.417L17.7 12.355H6.3L4.024 5.228a.9.9 0 0 0-.295-.417.913.913 0 0 0-.53-.163.906.906 0 0 0-.533.143.904.904 0 0 0-.308.434l-2.316 7.13a.593.593 0 0 0 .218.675l10.963 7.97a1.32 1.32 0 0 0 1.554 0l10.963-7.97a.593.593 0 0 0 .218-.675z"/></svg>';

function compareVersions(a, b) {
    var pa = a.split('.').map(Number);
    var pb = b.split('.').map(Number);
    for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
        var na = i < pa.length ? pa[i] : 0;
        var nb = i < pb.length ? pb[i] : 0;
        if (na > nb) return 1;
        if (na < nb) return -1;
    }
    return 0;
}

var toastTimer = null;

function requestNotifyPermission() {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
        Notification.requestPermission().catch(function() {});
    }
}

function showToast(message) {
    var toast = document.getElementById("toast-notification");
    var msgEl = document.getElementById("toast-message");
    if (!toast || !msgEl) return;
    msgEl.textContent = message || "New data available";
    toast.classList.add("visible");
    if (toastTimer) clearTimeout(toastTimer);
    requestNotifyPermission();
}

function hideToast() {
    var toast = document.getElementById("toast-notification");
    if (!toast) return;
    toast.classList.remove("visible");
    if (toastTimer) clearTimeout(toastTimer);
}
