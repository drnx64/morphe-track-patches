# Morphe Patch Tracker — Architecture Reference

## Overview

Morphe Patch Tracker is a fully automated monitoring system that crawls the
[Jman-Github/ReVanced-Patch-Bundles](https://github.com/Jman-Github/ReVanced-Patch-Bundles)
registry, discovers Morphe `.mpp` patch bundles, parses their compatible apps and patches,
detects changes via SHA-256 fingerprinting, accumulates daily changelogs, and renders a
dark-themed static web dashboard.

The pipeline runs on GitHub Actions every 6 hours and commits results back to the repo,
which is served via GitHub Pages.

---

## File Tree

```
MorpheTracker/
|
|-- .env                          # Telegram bot token & chat ID (secrets, gitignored)
|-- .gitignore
|-- README.md                     # Project README
|-- requirements.txt              # Python deps: requests, python-dotenv
|-- index.html                    # Dashboard SPA entry point
|-- changelog.html                # Historical changelog SPA entry point
|
|-- assets/
|   |-- app.js                    # Client-side rendering engine (~683 lines)
|   |-- style.css                 # Dark theme design system (~875 lines)
|
|-- data/
|   |-- live.json                 # Main dashboard database (stats + changes + full snapshot)
|   |-- changelog.json            # Root-level copy of output/changelog.json
|   |
|   |-- raw/
|   |   |-- tree.json             # GitHub Git Trees API output (file listing of bundles repo)
|   |   |-- parsed_bundles.json   # Parsed + fingerprinted bundle/app/patch data
|   |   |-- diff_result.json      # Current pipeline run's diff (new/updated/removed)
|   |   |-- bundles/              # Downloaded raw bundle JSONs (gitignored)
|   |
|   |-- state/
|   |   |-- current_snapshot.json # Most recent parse result (with fingerprints)
|   |   |-- previous_snapshot.json# Snapshot before current (for diffing)
|   |   |-- rollback_1..3.json    # Rollback history (3 deep)
|   |   |-- daily_buffer.json     # Today's accumulated changes
|   |   |-- last_run.json         # Pipeline metadata (errors, counts, timestamps)
|   |
|   |-- output/
|       |-- changelog.json        # Structured changelog (array of day entries)
|       |-- changelog.md          # Markdown changelog (human-readable)
|
|-- .github/workflows/
|   |-- update.yml                # CI/CD: runs pipeline 4x daily + manual trigger
|
|-- scripts/
    |-- run_pipeline.py           # Orchestrator (steps 1-9)
    |-- state_manager.py          # File I/O, dir management, snapshot rotation
    |-- fetch_patch_tree.py       # Step 1-2: crawl GitHub Git Trees API
    |-- download_bundles.py       # Step 3: download & validate Morphe bundle JSONs
    |-- parse_bundles.py          # Step 4: extract apps, patches, repo URLs
    |-- fingerprint_engine.py     # Step 5: SHA-256 fingerprinting
    |-- diff_engine.py            # Step 6: compare old vs new fingerprints
    |-- merge_daily_buffer.py     # Step 7-8: buffer, finalize day, update live.json
    |-- generate_site.py          # Step 9: regenerate static HTML/CSS/JS
    |-- telegram_notify.py        # Send daily changelog to Telegram
    |-- inspect_data.py           # Dev utility to inspect live.json
```

---

## Pipeline Data Flow

```
UPSTREAM REGISTRY                          LOCAL DISK                        WEB UI
(Jman-Github/                              (MorpheTracker repo)
 ReVanced-Patch-Bundles)

bundles branch
  |
  |--[1] fetch_patch_tree.py-------------> data/raw/tree.json
  |       (GitHub Git Trees API)
  |
  |--[2] download_bundles.py-------------> data/raw/bundles/<name>/<ch>/*.json
  |       (raw.githubusercontent.com)       (patches-bundle + patches-list)
  |
  |--[3] parse_bundles.py----------------> data/raw/parsed_bundles.json
  |       (compatiblePackages, repo URLs)
  |
  |--[4] fingerprint_engine.py-----------> (fingerprint fields added)
  |
  |--[5] diff_engine.py------------------> data/raw/diff_result.json
  |       (compare vs previous_snapshot)
  |
  |--[6] merge_daily_buffer.py-----------> data/state/daily_buffer.json
  |       (accumulate changes)
  |
  |       +-- day rollover? ------------> data/output/changelog.json (append)
  |       |                               data/output/changelog.md (prepend)
  |       |                               -> triggers generate_site.py
  |       |                               -> triggers telegram_notify.py
  |
  |       +-- always: -------> data/state/current_snapshot.json (rotated)
  |                            data/live.json (updated)
  |
  |--[7] generate_site.py---------------> index.html, changelog.html,
  |                                       assets/style.css, assets/app.js
  |
  +--[8] Browser loads app.js-----------> fetch data/live.json + data/changelog.json
                                            -> render dashboard / changelog
```

---

## Script-by-Script Breakdown

### 1. `state_manager.py` (128 lines)

**Role:** Core I/O layer — all file read/write goes through this module.

**Key functions:**

| Function | Purpose |
|----------|---------|
| `ensure_dirs()` | Creates all directories under `data/` |
| `load_json(path, default)` | Atomic JSON load with error handling |
| `save_json(path, data)` | Atomic write via `.tmp` temp file + rename |
| `rotate_rollbacks()` | current -> rollback_1 -> rollback_2 -> rollback_3 |
| `save_new_snapshot(data)` | Moves current to previous, rotates rollbacks, saves new current |
| `load_current_snapshot()` | Loads `data/state/current_snapshot.json` |
| `load_previous_snapshot()` | Loads `data/state/previous_snapshot.json` |
| `load_daily_buffer()` / `save_daily_buffer()` | Daily buffer I/O |
| `save_last_run()` / `load_last_run()` | Pipeline metadata I/O |
| `save_live_json()` / `load_live_json()` | Dashboard database I/O |

---

### 2. `fetch_patch_tree.py` (57 lines)

**Role:** Crawls the upstream registry file tree.

**What it does:**
- Calls GitHub Git Trees API on the `bundles` branch of `Jman-Github/ReVanced-Patch-Bundles`
- Recursively fetches the full tree
- Filters to only `patch-bundles/` directory blobs
- Saves all file metadata to `data/raw/tree.json`
- Uses `GITHUB_TOKEN` env var for auth, 3 retries with exponential backoff

---

### 3. `download_bundles.py` (209 lines)

**Role:** Downloads actual bundle JSON files from the registry.

**Key functions:**

| Function | Purpose |
|----------|---------|
| `group_tree_files(tree_files)` | Parses flat tree into `{bundle: {channel: {bundle_path, list_path}}}`. Handles both nested folder layout (`my-bundle/stable/`) and flat naming (`my-bundle-stable-patches-bundle.json`) |
| `download_file_with_retry(path)` | Downloads from `raw.githubusercontent.com`, 3 retries |
| `is_morphe_bundle(bundle_json)` | Critical filter: checks if `download_url` ends with `.mpp` AND has >= 8 path segments. **Non-Morphe bundles are skipped here** |
| `download_all_bundles()` | Orchestrator: clears raw dir, iterates groups, downloads + validates + saves both `patches-bundle.json` and `patches-list.json` |

---

### 4. `parse_bundles.py` (310 lines)

**Role:** Transforms raw downloads into structured bundle records.

**Key functions:**

| Function | Purpose |
|----------|---------|
| `get_app_name(package_name)` | Maps known package names to friendly names (e.g., `com.google.android.youtube` -> `YouTube`). Falls back to heuristic from last path segment |
| `extract_repo_url(bundle_json, name)` | Extracts repo URL from `download_url`, `patches.url`, `integrations.url`, or `description`. Falls back to `https://github.com/{name}/revanced-patches` |
| `_extract_versions(raw)` | Normalizes version entries (handles both strings and objects with `version` key) |
| `validate_and_parse_bundle(name, channel)` | Validates files, extracts `compatiblePackages`, builds structured records with patch details (name, description, compatible_versions, options, use flag) |
| `parse_all_bundles()` | Orchestrator: iterates all downloaded bundles, saves to `parsed_bundles.json` |

**Output data shape (`parsed_bundles.json`):**
```json
{
  "bundle-name:stable": {
    "bundle": "bundle-name",
    "channel": "stable",
    "repo_url": "https://github.com/username/revanced-patches",
    "created_at": "2026-06-17T06:17:24",
    "apps": [
      {
        "app_name": "YouTube",
        "package": "com.google.android.youtube",
        "patches": [
          {
            "name": "Hide Shorts",
            "description": "Hides Shorts tab",
            "use": true,
            "options": [{"key": "opt1", "description": "..."}],
            "compatible_versions": ["18.01.32", "18.02.33"]
          }
        ]
      }
    ],
    "fingerprint": "abc123..."
  }
}
```

---

### 5. `fingerprint_engine.py` (83 lines)

**Role:** Generates SHA-256 fingerprints for change detection.

**How it works:**
- Canonicalizes each bundle's content: sorts patches by name, options by key, versions alphabetically
- Serializes to deterministic JSON
- SHA-256 hashes the canonical JSON
- Stores the fingerprint in the `parsed_bundles.json` record

---

### 6. `diff_engine.py` (151 lines)

**Role:** Compares current parse result against the previous snapshot.

**Key functions:**

| Function | Purpose |
|----------|---------|
| `apps_are_different(old_app, new_app)` | Deep comparison: normalizes both apps' patches, options, versions; compares canonical JSON |
| `diff_snapshots()` | Loads old + new snapshots, iterates bundle:channel keys: |
| | - **New key** -> marks as `new_bundle` + all its apps as `new_apps` |
| | - **Fingerprint changed** -> app-level diff: checks for new/updated/removed apps |
| | - **Fingerprint same** -> skip |

**Output (`diff_result.json`):**
```json
{
  "new_bundles": [{"bundle": "name", "channel": "dev"}],
  "new_apps": [{"bundle": "name:dev", "app_name": "App", "package": "com.app"}],
  "updated_apps": [{"bundle": "name:stable", "app_name": "App", "package": "com.app"}],
  "removed_apps": []
}
```

Returns `False` if no changes detected (pipeline exits silently).

---

### 7. `merge_daily_buffer.py` (382 lines)

**Role:** The most complex script — manages daily change accumulation, day rollover, and all output file generation.

**Key functions:**

| Function | Purpose |
|----------|---------|
| `merge_apps_with_status(app_list, status)` | Merges apps into buffer with status precedence: new > updated > removed |
| `build_changelog_entry(date, bundles, apps)` | Creates `{date, new_bundles, new_apps}` for JSON changelog |
| `generate_markdown_changelog(date, bundles, apps)` | Generates Markdown with NEW/UPDATED/PRE-RELEASE badges |
| `finalize_buffer(buffer_data)` | Finalizes a 24h window: appends to `changelog.json`, prepends to `changelog.md`, writes `live.json` |
| `update_live_json_file(today, buffer, snapshot)` | Updates `live.json` with current snapshot + today's changes |
| `update_daily_buffer_run()` | Main entry point: handles day rollover (finalize old buffer -> reset), merges current diff, saves snapshot, triggers site gen + Telegram on rollover |

**Status precedence logic** (line 296-301):
- `new` overrides `updated` or `removed`
- `updated` overrides `removed`
- This prevents a degraded status from overwriting a higher-priority one within the same day

**Day rollover flow:**
1. Load `daily_buffer.json`
2. If buffer date != today -> finalize the old buffer first
3. Reset buffer for new day
4. Merge current `diff_result.json` into buffer
5. Save buffer
6. Rotate snapshots (current -> previous, rollbacks shifted)
7. Update `live.json`
8. If rollover happened: run `generate_site.py` + `telegram_notify.py`

**`live.json` output shape:**
```json
{
  "date": "2026-06-21",
  "last_run": "2026-06-21T12:01:00",
  "stats": {
    "total_bundles": 59,
    "total_apps": 291,
    "new_apps_today": 14,
    "new_bundles_today": 2
  },
  "changes": {
    "new_bundles": [{"bundle": "name", "channel": "stable"}, ...],
    "new_apps": [{"bundle": "name:stable", "app_name": "App", "package": "com.app", "status": "new"}, ...]
  },
  "bundles": { ... }  // full snapshot (same as current_snapshot.json)
}
```

---

### 8. `generate_site.py` (1030+ lines)

**Role:** Contains hardcoded Python string constants for the entire static site HTML, CSS, and JS.

**Key constant variables:**
- `INDEX_HTML_CONTENT` — Full `index.html` as a Python string
- `CHANGELOG_HTML_CONTENT` — Full `changelog.html` as a Python string
- `STYLE_CSS_CONTENT` — Full `assets/style.css` as a Python string
- `APP_JS_CONTENT` — Full `assets/app.js` as a Python string

**Important:** The actual working static files (`index.html`, `changelog.html`, `assets/*`) are maintained **directly on disk**. The `generate_site.py` file acts as a backup — when the pipeline runs on a fresh checkout (e.g., GitHub Actions), it writes these hardcoded strings to disk if the files are missing. Currently `generate_static_files()` is a `pass` placeholder, meaning the on-disk files are the primary source.

---

### 9. `telegram_notify.py` (111 lines)

**Role:** Sends daily changelog summary to a Telegram channel.

**What it does:**
1. Loads `TG_TOKEN` and `TG_CHAT` from `.env`
2. Reads the daily markdown changelog from `data/output/today_changelog.md`
3. Strips/markdown dates and converts `#`/`##`/`###` headers to Telegram bold `*text*`
4. Composes message with title + timestamp + cleaned changelog
5. Sends via Telegram Bot API

---

### 10. `run_pipeline.py` (65 lines)

**Role:** Orchestrator — runs all pipeline steps in order.

**Execution flow:**
1. `ensure_dirs()`
2. `fetch_bundle_tree()` -> tree.json
3. `download_all_bundles()` -> raw bundles
4. `parse_all_bundles()` -> parsed_bundles.json
5. `generate_bundle_fingerprints()` -> adds fingerprints
6. `diff_snapshots()` -> diff_result.json
7. If no changes AND no day rollover needed -> **exit silently**
8. `update_daily_buffer_run()` -> buffer, snapshots, live.json
9. `generate_static_files()` -> (placeholder)

---

## Frontend Architecture

### Entry Points

| File | Route | What it does |
|------|-------|--------------|
| `index.html` | `/` (Dashboard) | Loads `app.js` -> `initDashboard()` |
| `changelog.html` | `/changelog.html` | Loads `app.js` -> `initChangelog()` |

### `app.js` Key Functions

| Function | Trigger | What it renders |
|----------|---------|-----------------|
| `initDashboard()` | `DOMContentLoaded` + `#nav-dashboard.active` | Fetches `data/live.json`, renders stats, today's updates, bundle grid with filters |
| `initChangelog()` | `DOMContentLoaded` + `#nav-changelog.active` | Fetches `data/changelog.json` + `data/live.json`, renders historical changelog |
| `renderStats(data)` | Called by `initDashboard` | Populates 4 stat cards from `data.stats` |
| `renderTodayUpdates(data)` | Called by `initDashboard` | Groups `changes.new_bundles` + `changes.new_apps` by bundle name, renders with NEW BUNDLE / UPDATED / NEW APP / UPDATED APP / REMOVED APP / PRE-RELEASE badges |
| `filterAndRenderBundles()` | Called by `initDashboard` + filter events | Groups bundle:channel entries by base name, applies search/channel filters, sorts (priority list -> app count desc -> alpha), renders expandable cards with app tabs, version chips, patch details |
| `renderChangelog(changelog, bundlesData)` | Called by `initChangelog` | Iterates changelog entries, groups by bundle, renders cards with date headers and NEW BUNDLE / UPDATED status badges |
| `getAuthorLink(repoUrl)` | Utility | Extracts GitHub/GitLab author from repo URL, generates `<a>` tag |
| `getRepoInfo(repoUrl)` | Utility | Extracts `{isGitLab, path}` from repo URL |
| `isAppPreRelease(bundleName, pkgName, bundlesData)` | Utility | Returns true if app is in dev channel but NOT in stable channel |
| `togglePatch(event, patchId)` | User click on patch item | Toggles `.expanded` class on patch item to show/hide options |

### Bundle Card Rendering (Dashboard)

Each bundle card displays:
1. **Header**: Bundle name + channel badges (green=stable, amber=dev) + GitHub/GitLab icon
2. **Summary**: "N compatible apps"
3. **Expandable drawer**: App tabs, version chips ("Any" or specific versions, capped at 6 + "+N more"), patch list (expandable with description + options)
4. **"Add to Morphe" button**: Links to `https://morphe.software/add-source?github=<path>` or `?gitlab=<path>`

Sorting priority (defined at `app.js:336`):
```
[morphe, piko, rookieenough, hoo-dles, paresh-maheshwari, brosssh, patcheddit]
```
Remaining bundles sorted by app count descending, then alphabetically.

### Changelog Page Rendering

Each day card shows:
1. **Date header** (e.g., "June 21, 2026")
2. **Per-bundle groups**:
   - New bundle: "NEW BUNDLE" badge + bundle name + channels
   - Existing bundle with changes: "UPDATED" badge + bundle name
3. **App list**: Each app shows its status badge (NEW APP / UPDATED APP / REMOVED APP) + PRE-RELEASE indicator + app name (linked to Google Play) + package name

---

## Badge Reference

| Badge | CSS class | Color | Purpose |
|-------|-----------|-------|---------|
| NEW BUNDLE | `.badge-new-bundle` | Purple | A bundle appeared for the first time |
| UPDATED | `.badge-updated` | Blue | An existing bundle received app changes |
| NEW APP | `.badge-new` | Green | A new app was added to a bundle |
| UPDATED APP | `.badge-updated` | Blue | An existing app's patches/options changed |
| REMOVED APP | `.badge-removed` | Red | An app was removed from a bundle |
| PRE-RELEASE | `.badge-pre-release` | Amber | App exists in dev channel but not stable |

---

## GitHub Actions Pipeline

File: `.github/workflows/update.yml`

```yaml
Schedule:    1 0,6,12,18 * * *  (UTC: 00:01, 06:01, 12:01, 18:01)
Trigger:     manual workflow_dispatch
Concurrency: group "morphe-patch-tracker"

Steps:
  1. Checkout repo (full history, fetch-depth: 0)
  2. Setup Python 3.10 (with pip cache)
  3. pip install -r requirements.txt
  4. python scripts/run_pipeline.py
     (secrets: GITHUB_TOKEN, TG_TOKEN, TG_CHAT)
  5. git add -A && git commit -m "chore(data): auto-update..." [skip ci]
     (only if files changed)
  6. git push
```

---

## Changelog Generation Lifecycle (Detailed)

This is the most important flow — how a detected change becomes a visible changelog entry:

### Step 1: Diff Detection
`diff_engine.py:diff_snapshots()` compares `current_snapshot.json` (from last run) against the new `parsed_bundles.json`. It produces `diff_result.json` with four arrays:
- `new_bundles`: Entirely new bundle:channel keys
- `new_apps`: New package names in existing bundles
- `updated_apps`: Existing packages whose patches/options/versions changed
- `removed_apps`: Packages that disappeared

### Step 2: Buffer Accumulation
`merge_daily_buffer.py:update_daily_buffer_run()` merges each run's diff into `daily_buffer.json`.
- Bundles are deduplicated by `bundle_name:channel`
- Apps are deduplicated by `(bundle_key, package)` tuple
- Status priority: **new > updated > removed** (a "new" app won't be downgraded to "updated")

### Step 3: Day Rollover
When the buffer's date differs from today:
1. `finalize_buffer()` is called with the old buffer's data
2. This creates a `changelog.json` entry: `{date, new_bundles[], new_apps[]}` (prepended to array)
3. A markdown changelog block is generated and prepended to `changelog.md`
4. `live.json` is updated with stats + changes + full snapshot
5. `generate_site.py` is triggered to rebuild static assets
6. `telegram_notify.py` sends the daily summary

### Step 4: Frontend Rendering
- Dashboard: `renderTodayUpdates()` groups `changes.new_bundles` and `changes.new_apps` by base bundle name. If a bundle appears only in `new_apps` (not `new_bundles`), it gets the **UPDATED** badge.
- Changelog page: `renderChangelog()` does the same grouping. If `newChannels.length > 0`, the bundle was newly registered -> **NEW BUNDLE**. Otherwise -> **UPDATED**.

---

## Key Data Shapes

### `data/live.json` (Dashboard Database)
```json
{
  "date": "2026-06-21",
  "last_run": "2026-06-21T12:01:00",
  "stats": {
    "total_bundles": 59,
    "total_apps": 291,
    "new_apps_today": 14,
    "new_bundles_today": 2
  },
  "changes": {
    "new_bundles": [{"bundle": "name", "channel": "stable"}],
    "new_apps": [{"bundle": "name:stable", "app_name": "App", "package": "com.app", "status": "new"}]
  },
  "bundles": { "bundle-name:stable": { "bundle": "...", "channel": "...", ... } }
}
```

### `data/output/changelog.json` (Historical)
```json
[
  { "date": "2026-06-21", "new_bundles": [...], "new_apps": [...] },
  { "date": "2026-06-20", "new_bundles": [...], "new_apps": [...] }
]
```

### `data/state/daily_buffer.json` (Accumulation Buffer)
```json
{
  "date": "2026-06-21",
  "bundles": { "bundle-name:stable": {"bundle": "name", "channel": "stable"} },
  "apps": [
    { "bundle": "name:stable", "app_name": "App", "package": "com.app", "status": "new" }
  ]
}
```

---

## CSS Architecture (`assets/style.css`)

The design system uses CSS custom properties with a dark theme:

```
:root ──> --bg-main (dark navy)
       ──> --bg-card (semi-transparent glass)
       ──> --primary-accent (#6366f1 indigo)
       ──> --color-stable (#10b981 green)
       ──> --color-dev (#f59e0b amber)
       ──> --color-critical (#f43f5e red)
       ──> --color-normal (#3b82f6 blue)
       ──> --color-rare (#8b5cf6 purple)
```

Key layout features:
- **Glow orbs**: Fixed background blur elements (indigo + purple)
- **Glassmorphism**: Cards use `backdrop-filter: blur(10px)` with semi-transparent backgrounds
- **Responsive grid**: 1 col mobile -> 2 col tablet -> 3 col desktop
- **Bundle cards**: Clickable, expandable with smooth `max-height` transition
- **App tabs**: Horizontal scrollable tab bar within each bundle card
- **Patch items**: Expandable to show description + options

---

## Development Notes

### Running the Pipeline Locally

```bash
pip install -r requirements.txt
set GITHUB_TOKEN=your_github_token
set TG_TOKEN=your_telegram_token
set TG_CHAT=your_chat_id
python scripts/run_pipeline.py
```

### Key Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `GITHUB_TOKEN` | Yes | GitHub API auth for fetching tree |
| `TG_TOKEN` | No (optional) | Telegram bot token for notifications |
| `TG_CHAT` | No (optional) | Telegram chat ID for notifications |

### Inspecting Data

```bash
python scripts/inspect_data.py
```
This prints the first bundle + app with patches from `live.json` for debugging.

### Manual Finalization

```bash
python scripts/merge_daily_buffer.py --finalize
```
Forces the current daily buffer to finalize immediately (creates changelog entry, triggers site gen + notification), even if there's no day rollover.
