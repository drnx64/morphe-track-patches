import os
import shutil
from state_manager import ensure_dirs, DOCS_DIR, DOCS_DATA_DIR, OUTPUT_DIR, save_json, load_json

INDEX_HTML_CONTENT = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Morphe Patch Tracker — Dashboard</title>
    <meta name="description" content="Automated patch tracker and change detector for Morphe application patches. Monitor new apps and updates.">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/style.css">
</head>
<body>
    <div class="glow-container">
        <div class="glow-orb main-orb"></div>
        <div class="glow-orb sub-orb"></div>
    </div>
    
    <header class="app-header">
        <div class="header-content">
            <h1 id="main-title">Morphe Patch Tracker</h1>
            <p class="subtitle">Automated compatibility & update monitoring for Morphe patches</p>
            <nav class="main-nav">
                <a href="index.html" class="nav-link active" id="nav-dashboard">Dashboard</a>
                <a href="changelog.html" class="nav-link" id="nav-changelog">Changelog History</a>
            </nav>
        </div>
    </header>

    <main class="dashboard-container">
        <!-- Today's Updates Section (Integrated Changelog at Top) -->
        <section class="today-updates-section" aria-labelledby="updates-title-heading">
            <div class="updates-card">
                <div class="updates-header">
                    <h2 class="updates-title" id="updates-title-heading">Changelog</h2>
                    <span class="updates-date" id="updates-date-label">Updated: June 20, 2026</span>
                </div>
                <div class="updates-body" id="today-updates-container">
                    <div class="loading-state">Loading latest updates...</div>
                </div>
            </div>
        </section>

        <!-- Stats Summary Section -->
        <section class="stats-section" aria-labelledby="stats-heading">
            <h2 class="sr-only" id="stats-heading">Quick Statistics</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <span class="stat-label">Total Bundles</span>
                    <span class="stat-value" id="stat-total-bundles">-</span>
                </div>
                <div class="stat-card">
                    <span class="stat-label">Total Apps</span>
                    <span class="stat-value" id="stat-total-apps">-</span>
                </div>
                <div class="stat-card highlight">
                    <span class="stat-label">New Apps Today</span>
                    <span class="stat-value" id="stat-new-apps-today">-</span>
                </div>
                <div class="stat-card highlight">
                    <span class="stat-label">New Bundles Today</span>
                    <span class="stat-value" id="stat-new-bundles-today">-</span>
                </div>
            </div>
            <div class="last-updated-row">
                <span>Last checked: <strong id="val-last-checked">-</strong></span>
            </div>
        </section>

        <!-- Controls Section -->
        <section class="controls-section" aria-labelledby="controls-heading">
            <h2 class="sr-only" id="controls-heading">Search Morphe Patches</h2>
            <div class="filters-row">
                <div class="search-bar">
                    <input type="text" id="search-input" placeholder="Search by app name, package name, or bundle..." aria-label="Search patches">
                </div>
                <div class="filter-group">
                    <span class="filter-label">Channel:</span>
                    <button class="filter-btn active" id="btn-filter-all" data-channel="all">All</button>
                    <button class="filter-btn" id="btn-filter-stable" data-channel="stable">Stable</button>
                    <button class="filter-btn" id="btn-filter-dev" data-channel="dev">Dev</button>
                </div>
            </div>
        </section>

        <!-- Bundles Grid Section -->
        <section class="bundles-section" aria-labelledby="bundles-heading">
            <h2 class="section-title" id="bundles-heading">Patch Bundles</h2>
            <div class="bundles-grid" id="bundles-grid-container">
                <div class="loading-state">Loading dashboard data...</div>
            </div>
        </section>
    </main>

    <footer class="app-footer">
        <p>&copy; 2026 Morphe Patch Tracker. Automated update pipeline.</p>
    </footer>

    <script src="assets/app.js"></script>
</body>
</html>
"""

CHANGELOG_HTML_CONTENT = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Morphe Patch Tracker — Historical Changelog</title>
    <meta name="description" content="Changelog history for Morphe application patch bundles. View daily updates.">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/style.css">
</head>
<body>
    <div class="glow-container">
        <div class="glow-orb main-orb"></div>
        <div class="glow-orb sub-orb"></div>
    </div>
    
    <header class="app-header">
        <div class="header-content">
            <h1 id="main-title">Morphe Patch Tracker</h1>
            <p class="subtitle">Automated compatibility & update monitoring for Morphe patches</p>
            <nav class="main-nav">
                <a href="index.html" class="nav-link" id="nav-dashboard">Dashboard</a>
                <a href="changelog.html" class="nav-link active" id="nav-changelog">Changelog History</a>
            </nav>
        </div>
    </header>

    <main class="dashboard-container">
        <section class="changelog-section" aria-labelledby="changelog-heading">
            <h2 class="section-title" id="changelog-heading">Historical Updates</h2>
            <div class="changelog-list" id="changelog-list-container">
                <div class="loading-state">Loading changelog data...</div>
            </div>
        </section>
    </main>

    <footer class="app-footer">
        <p>&copy; 2026 Morphe Patch Tracker. Automated update pipeline.</p>
    </footer>

    <script src="assets/app.js"></script>
</body>
</html>
"""

STYLE_CSS_CONTENT = """/* CSS Design System with Outfit font */
:root {
    --bg-main: #0b0f19;
    --bg-card: rgba(20, 29, 47, 0.7);
    --bg-card-inner: rgba(255, 255, 255, 0.025);
    --border-color: rgba(255, 255, 255, 0.08);
    --border-color-hover: rgba(255, 255, 255, 0.15);
    --text-primary: #f3f4f6;
    --text-secondary: #9ca3af;
    --primary-accent: #6366f1;
    --accent-glow: rgba(99, 102, 241, 0.15);

    --color-stable: #10b981;
    --color-dev: #f59e0b;
    --color-critical: #f43f5e;
    --color-normal: #3b82f6;
    --color-rare: #8b5cf6;

    --font-stack: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --transition-speed: 0.22s;
    --border-radius: 12px;
    --border-radius-sm: 8px;
}

*, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: var(--font-stack);
    background-color: var(--bg-main);
    color: var(--text-primary);
    line-height: 1.5;
    padding-bottom: 3rem;
    overflow-x: hidden;
    position: relative;
    min-height: 100vh;
    -webkit-tap-highlight-color: transparent;
}

/* ── Background orbs ─────────────────────────────────── */
.glow-container {
    position: fixed;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    pointer-events: none;
}

.glow-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(120px);
    opacity: 0.22;
}

.main-orb {
    width: clamp(280px, 55vw, 700px);
    height: clamp(280px, 55vw, 700px);
    background-color: var(--primary-accent);
    top: -15%;
    right: -10%;
}

.sub-orb {
    width: clamp(200px, 40vw, 560px);
    height: clamp(200px, 40vw, 560px);
    background-color: var(--color-rare);
    bottom: -10%;
    left: -8%;
}

.sr-only {
    position: absolute;
    width: 1px; height: 1px;
    padding: 0; margin: -1px;
    overflow: hidden;
    clip: rect(0,0,0,0);
    border: 0;
}

/* ── Header ──────────────────────────────────────────── */
.app-header {
    background-color: rgba(11, 15, 25, 0.88);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--border-color);
    padding: 1.25rem 1rem;
    position: sticky;
    top: 0;
    z-index: 100;
}

.header-content {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.35rem;
}

h1 {
    font-size: clamp(1.4rem, 4vw, 1.85rem);
    font-weight: 700;
    letter-spacing: -0.5px;
    background: linear-gradient(135deg, #fff 0%, #a5b4fc 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.subtitle {
    font-size: clamp(0.8rem, 2.5vw, 0.95rem);
    color: var(--text-secondary);
    padding: 0 0.5rem;
}

.main-nav {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
    background: rgba(255,255,255,0.03);
    padding: 4px;
    border-radius: 20px;
    border: 1px solid var(--border-color);
}

.nav-link {
    text-decoration: none;
    color: var(--text-secondary);
    padding: 6px 14px;
    font-size: 0.88rem;
    font-weight: 500;
    border-radius: 16px;
    transition: all var(--transition-speed) ease;
    white-space: nowrap;
}

.nav-link:hover { color: var(--text-primary); }

.nav-link.active {
    background-color: var(--primary-accent);
    color: #fff;
    box-shadow: 0 4px 12px rgba(99,102,241,0.35);
}

/* ── Main layout ─────────────────────────────────────── */
.dashboard-container {
    max-width: 1200px;
    margin: 1.5rem auto;
    padding: 0 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

@media (min-width: 640px) {
    .dashboard-container { padding: 0 1.25rem; margin: 2rem auto; }
}

/* ── Today's Updates ─────────────────────────────────── */
.today-updates-section { width: 100%; }

.updates-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 1.25rem;
    backdrop-filter: blur(10px);
    border-left: 4px solid var(--primary-accent);
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
}

.updates-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 0.5rem;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    padding-bottom: 0.75rem;
    margin-bottom: 1rem;
}

.updates-title { font-size: 1.15rem; font-weight: 600; color: #fff; }
.updates-date { font-size: 0.85rem; color: var(--text-secondary); font-weight: 500; }

.updates-body { display: flex; flex-direction: column; gap: 0.75rem; }

.update-row {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    font-size: 0.88rem;
    flex-wrap: wrap;
    line-height: 1.6;
}

/* ── Badges ──────────────────────────────────────────── */
.badge {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.4px;
    padding: 2px 7px;
    border-radius: 4px;
    text-transform: uppercase;
    display: inline-block;
    white-space: nowrap;
    flex-shrink: 0;
}

.badge-new-bundle { background: rgba(139,92,246,0.15); color: var(--color-rare); border: 1px solid rgba(139,92,246,0.3); }
.badge-new       { background: rgba(16,185,129,0.15); color: var(--color-stable); border: 1px solid rgba(16,185,129,0.3); }
.badge-updated   { background: rgba(59,130,246,0.15); color: var(--color-normal); border: 1px solid rgba(59,130,246,0.3); }
.badge-removed   { background: rgba(244,63,94,0.15); color: var(--color-critical); border: 1px solid rgba(244,63,94,0.3); }
.badge-pre-release { background: rgba(245,158,11,0.15); color: var(--color-dev); border: 1px solid rgba(245,158,11,0.3); }

.update-bundle-group { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.75rem; }

.update-bundle-apps {
    margin-left: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border-left: 2px solid rgba(255,255,255,0.05);
    padding-left: 0.75rem;
}

.author-link {
    color: var(--primary-accent);
    text-decoration: none;
    font-weight: 500;
    transition: color var(--transition-speed);
}
.author-link:hover { color: #818cf8; text-decoration: underline; }

.no-updates-msg { font-size: 0.9rem; color: var(--text-secondary); font-style: italic; }

/* ── Stats ───────────────────────────────────────────── */
.stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
}

@media (min-width: 640px) { .stats-grid { grid-template-columns: repeat(4, 1fr); gap: 1rem; } }

.stat-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(10px);
    transition: transform var(--transition-speed) ease, border-color var(--transition-speed) ease;
}

.stat-card:hover { border-color: var(--border-color-hover); transform: translateY(-2px); }
.stat-card.highlight { border-left: 3px solid var(--primary-accent); }

.stat-label {
    font-size: 0.78rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 0.4rem;
    text-align: center;
}

.stat-value { font-size: clamp(1.4rem, 4vw, 1.75rem); font-weight: 700; color: #fff; }

.last-updated-row {
    font-size: 0.82rem;
    color: var(--text-secondary);
    text-align: right;
    margin-top: 0.5rem;
}

/* ── Controls ────────────────────────────────────────── */
.controls-section {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 1.25rem;
    backdrop-filter: blur(10px);
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.filters-row {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

@media (min-width: 640px) {
    .filters-row { flex-direction: row; justify-content: space-between; align-items: center; }
    .search-bar { flex-grow: 1; max-width: 480px; }
}

.search-bar input {
    width: 100%;
    background-color: rgba(255,255,255,0.05);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    padding: 10px 14px;
    color: #fff;
    font-family: var(--font-stack);
    font-size: 0.95rem;
    outline: none;
    transition: border-color var(--transition-speed);
    -webkit-appearance: none;
}

.search-bar input::placeholder { color: var(--text-secondary); }
.search-bar input:focus { border-color: var(--primary-accent); }

.filter-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.filter-label { font-size: 0.88rem; color: var(--text-secondary); font-weight: 500; }

.filter-btn {
    background: rgba(255,255,255,0.04);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    padding: 6px 14px;
    font-size: 0.85rem;
    font-weight: 500;
    border-radius: 6px;
    cursor: pointer;
    font-family: var(--font-stack);
    transition: all var(--transition-speed);
    min-height: 36px;
    touch-action: manipulation;
}

.filter-btn:hover { color: var(--text-primary); border-color: var(--border-color-hover); }
.filter-btn.active { background: var(--primary-accent); color: #fff; border-color: var(--primary-accent); }

/* ── Bundle Grid ─────────────────────────────────────── */
.section-title {
    font-size: clamp(1.15rem, 3vw, 1.4rem);
    font-weight: 600;
    margin-bottom: 1rem;
    position: relative;
    padding-left: 0.75rem;
}

.section-title::before {
    content: '';
    position: absolute;
    left: 0; top: 15%;
    height: 70%; width: 3px;
    background-color: var(--primary-accent);
    border-radius: 2px;
}

.bundles-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
}

@media (min-width: 640px) { .bundles-grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1024px) { .bundles-grid { grid-template-columns: repeat(3, 1fr); } }

/* ── Bundle Card ─────────────────────────────────────── */
.bundle-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 1.1rem;
    backdrop-filter: blur(10px);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    position: relative;
    transition: all var(--transition-speed) cubic-bezier(0.4, 0, 0.2, 1);
    touch-action: manipulation;
}

.bundle-card:hover {
    border-color: var(--border-color-hover);
    box-shadow: 0 8px 24px rgba(0,0,0,0.25);
    transform: translateY(-2px);
}

.bundle-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.5rem;
}

.bundle-title-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 0;
    flex: 1;
}

.bundle-name-title {
    font-size: 1.05rem;
    font-weight: 600;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.channel-badges-group { display: flex; gap: 4px; flex-wrap: wrap; }

.channel-badge {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    padding: 2px 7px;
    border-radius: 4px;
    white-space: nowrap;
}

.channel-badge.stable {
    background: rgba(16,185,129,0.15);
    color: var(--color-stable);
    border: 1px solid rgba(16,185,129,0.25);
}

.channel-badge.dev {
    background: rgba(245,158,11,0.15);
    color: var(--color-dev);
    border: 1px solid rgba(245,158,11,0.25);
}

.github-repo-icon-link {
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    min-width: 32px;
    width: 32px;
    height: 32px;
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--border-color);
    transition: all var(--transition-speed);
    flex-shrink: 0;
}

.github-repo-icon-link:hover {
    color: #fff;
    background: rgba(255,255,255,0.08);
    transform: scale(1.08);
    border-color: var(--border-color-hover);
}

.apps-summary { font-size: 0.82rem; color: var(--text-secondary); }

/* ── Apps list drawer inside card ────────────────────── */
.apps-list-drawer {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease-out;
    border-top: 1px solid transparent;
    margin-top: 0.25rem;
}

.bundle-card.expanded .apps-list-drawer {
    max-height: 900px;
    border-top: 1px solid rgba(255,255,255,0.05);
    padding-top: 0.75rem;
}

/* ── App tabs ────────────────────────────────────────── */
.app-tabs-row {
    display: flex;
    overflow-x: auto;
    gap: 0.4rem;
    padding-bottom: 0.5rem;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.1) transparent;
    -webkit-overflow-scrolling: touch;
}

.app-tabs-row::-webkit-scrollbar { height: 3px; }
.app-tabs-row::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }

.app-tab-btn {
    background: rgba(255,255,255,0.04);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    padding: 5px 12px;
    font-size: 0.8rem;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    font-family: var(--font-stack);
    white-space: nowrap;
    transition: all var(--transition-speed);
    flex-shrink: 0;
    min-height: 30px;
    touch-action: manipulation;
}

.app-tab-btn:hover { color: var(--text-primary); border-color: var(--border-color-hover); }

.app-tab-btn.active {
    background: rgba(99,102,241,0.18);
    color: #a5b4fc;
    border-color: rgba(99,102,241,0.45);
}

/* ── App panel (versions + patches) ─────────────────── */
.app-panel { display: none; flex-direction: column; gap: 0.75rem; }
.app-panel.active { display: flex; }

.app-panel-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0;
}

.app-pkg-link {
    color: var(--color-normal);
    font-size: 0.75rem;
    text-decoration: none;
    font-weight: 500;
    background: rgba(59,130,246,0.08);
    border: 1px solid rgba(59,130,246,0.2);
    border-radius: 4px;
    padding: 2px 8px;
    word-break: break-all;
    transition: color var(--transition-speed), background var(--transition-speed);
}

.app-pkg-link:hover { color: #60a5fa; background: rgba(59,130,246,0.14); }

/* ── Version chips row ───────────────────────────────── */
.versions-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
    padding: 0.5rem 0 0.25rem;
}

.versions-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.4px;
    margin-right: 0.25rem;
}

.version-chip {
    font-size: 0.72rem;
    font-weight: 700;
    font-family: 'SF Mono', 'Fira Code', monospace;
    padding: 2px 8px;
    border-radius: 20px;
    background: rgba(16,185,129,0.1);
    color: var(--color-stable);
    border: 1px solid rgba(16,185,129,0.25);
    white-space: nowrap;
}

.version-chip.any {
    background: rgba(99,102,241,0.1);
    color: #a5b4fc;
    border-color: rgba(99,102,241,0.25);
}

/* ── Patch list ──────────────────────────────────────── */
.patches-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    max-height: 320px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.1) transparent;
}

.patches-list::-webkit-scrollbar { width: 4px; }
.patches-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }

.patch-item {
    background: var(--bg-card-inner);
    border: 1px solid rgba(255,255,255,0.04);
    border-radius: var(--border-radius-sm);
    padding: 0.6rem 0.8rem;
    cursor: pointer;
    transition: border-color var(--transition-speed), background var(--transition-speed);
}

.patch-item:hover { border-color: rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); }

.patch-item-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.5rem;
}

.patch-name {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--text-primary);
    flex: 1;
    min-width: 0;
}

.patch-off-badge {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(245,158,11,0.12);
    color: var(--color-dev);
    border: 1px solid rgba(245,158,11,0.25);
    white-space: nowrap;
    flex-shrink: 0;
}

.patch-desc {
    font-size: 0.78rem;
    color: var(--text-secondary);
    margin-top: 0.3rem;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.patch-item.expanded .patch-desc {
    display: block;
    -webkit-line-clamp: unset;
}

/* Patch options drawer */
.patch-options {
    display: none;
    flex-direction: column;
    gap: 0.4rem;
    margin-top: 0.5rem;
    padding: 0.6rem 0.75rem;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 6px;
}

.patch-item.expanded .patch-options { display: flex; }

.patch-option-key {
    font-size: 0.75rem;
    font-weight: 600;
    color: #a5b4fc;
}

.patch-option-desc {
    font-size: 0.73rem;
    color: var(--text-secondary);
    margin-top: 1px;
}

.patch-expand-hint {
    font-size: 0.7rem;
    color: var(--text-secondary);
    margin-top: 0.3rem;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    opacity: 0.7;
}

.patch-expand-hint svg { transition: transform var(--transition-speed); }
.patch-item.expanded .patch-expand-hint svg { transform: rotate(180deg); }

/* Fallback: simple app list (no tabs, used for single-app bundles) */
.apps-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    max-height: 260px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.1) transparent;
}

.apps-list::-webkit-scrollbar { width: 4px; }
.apps-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

.app-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--bg-card-inner);
    border: 1px solid rgba(255,255,255,0.03);
    border-radius: 6px;
    padding: 6px 10px;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.app-name-label { font-size: 0.85rem; font-weight: 500; }

.app-pkg-label {
    font-size: 0.72rem;
    color: var(--text-secondary);
    word-break: break-all;
}

.app-play-link {
    color: var(--color-normal);
    text-decoration: none;
    font-weight: 500;
    transition: color var(--transition-speed);
}

.app-play-link:hover { color: #60a5fa; text-decoration: underline; }

/* ── Add to Morphe button ────────────────────────────── */
.add-morphe-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--primary-accent) 0%, #4f46e5 100%);
    color: #fff;
    text-decoration: none;
    padding: 9px 18px;
    font-size: 0.85rem;
    font-weight: 600;
    border-radius: var(--border-radius-sm);
    margin-top: 0.5rem;
    border: 1px solid rgba(255,255,255,0.1);
    box-shadow: 0 4px 12px rgba(99,102,241,0.25);
    transition: all var(--transition-speed);
    cursor: pointer;
    text-align: center;
    touch-action: manipulation;
    width: 100%;
}

.add-morphe-btn:hover {
    background: linear-gradient(135deg, #818cf8 0%, #6366f1 100%);
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(99,102,241,0.35);
}

/* ── Loading / Error ─────────────────────────────────── */
.loading-state, .error-state {
    grid-column: 1 / -1;
    text-align: center;
    padding: 2.5rem;
    color: var(--text-secondary);
    font-weight: 500;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    backdrop-filter: blur(10px);
}

/* ── Changelog ───────────────────────────────────────── */
.changelog-list { display: flex; flex-direction: column; gap: 1.5rem; }

.changelog-day-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 1.25rem;
    backdrop-filter: blur(10px);
}

.changelog-date-header {
    font-size: 1.15rem;
    font-weight: 700;
    margin-bottom: 1.1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    color: #fff;
}

.changelog-category { margin-bottom: 1.1rem; }
.changelog-category:last-child { margin-bottom: 0; }

.changelog-cat-title {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 0.6rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.changelog-cat-title.bundles-title { color: var(--color-dev); }
.changelog-cat-title.apps-title { color: var(--color-normal); }

.changelog-items-list { list-style: none; display: flex; flex-direction: column; gap: 0.4rem; }

.changelog-item {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.03);
    border-radius: var(--border-radius-sm);
    padding: 8px 12px;
    font-size: 0.88rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.changelog-bundle-group { margin-bottom: 1.25rem; }
.changelog-bundle-group:last-child { margin-bottom: 0; }

.changelog-bundle-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.92rem;
    font-weight: 600;
    margin-bottom: 0.4rem;
    flex-wrap: wrap;
}

.changelog-bundle-apps {
    margin-left: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    border-left: 2px solid rgba(255,255,255,0.05);
    padding-left: 0.75rem;
    list-style: none;
}

.highlight-app { color: var(--color-stable); font-weight: 600; }

/* ── Footer ──────────────────────────────────────────── */
.app-footer {
    max-width: 1200px;
    margin: 2rem auto 0;
    padding: 1.25rem 1rem 0;
    border-top: 1px solid var(--border-color);
    text-align: center;
    color: var(--text-secondary);
}
.apps-list::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
}
.apps-list::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
}
"""

APP_JS_CONTENT = """// Dynamic UI engine
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
    const gitlabMatch = repoUrl.match(/https:\\/\\/gitlab\\.com\\/([^/]+)/);
    if (gitlabMatch) {
        const author = gitlabMatch[1];
        return `<a href="https://gitlab.com/${author}" target="_blank" class="author-link">@${author}</a>`;
    }
    const match = repoUrl.match(/https:\\/\\/github\\.com\\/([^/]+)/);
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
"""

def generate_static_files():
    ensure_dirs()
    
    # 1. Write HTML files
    print("Writing index.html...")
    with open(os.path.join(DOCS_DIR, "index.html"), "w", encoding="utf-8") as f:
        f.write(INDEX_HTML_CONTENT)
        
    print("Writing changelog.html...")
    with open(os.path.join(DOCS_DIR, "changelog.html"), "w", encoding="utf-8") as f:
        f.write(CHANGELOG_HTML_CONTENT)
        
    # 2. Write CSS and JS files
    assets_dir = os.path.join(DOCS_DIR, "assets")
    os.makedirs(assets_dir, exist_ok=True)
    
    print("Writing style.css...")
    with open(os.path.join(assets_dir, "style.css"), "w", encoding="utf-8") as f:
        f.write(STYLE_CSS_CONTENT)
        
    print("Writing app.js...")
    with open(os.path.join(assets_dir, "app.js"), "w", encoding="utf-8") as f:
        f.write(APP_JS_CONTENT)
        
    # 3. Copy changelog.json to docs/data/changelog.json
    changelog_src = os.path.join(OUTPUT_DIR, "changelog.json")
    changelog_dest = os.path.join(DOCS_DATA_DIR, "changelog.json")
    if os.path.exists(changelog_src):
        print(f"Copying {changelog_src} to {changelog_dest}...")
        shutil.copy2(changelog_src, changelog_dest)
    else:
        # If not present, save empty json array to avoid fetch errors
        save_json(changelog_dest, [])
        
    print("Static site generated successfully in the root directory.")

if __name__ == "__main__":
    generate_static_files()
