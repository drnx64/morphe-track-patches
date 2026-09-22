# MorpheTracker — Agent Reference

## Commands

| Task | Command | Notes |
|------|---------|-------|
| Dev server | `npm run dev` | `npx serve .` on port 3000. Never use `file://`. |
| Build | `npm run build` | `node scripts/build.js` — copies to `docs/` (gitignored build output, pushed to `gh-pages` by CI). |
| Preview | `npm run preview` | `npx serve docs` — preview production build locally. |
| Python tests | `python -m pytest tests/ -v` | Requires `pip install -r requirements.txt`. |
| Run pipeline | `python scripts/run_pipeline.py` | Requires `GITHUB_TOKEN` env var. |
| Manual finalization | `python scripts/merge_daily_buffer.py --finalize` | Force-flush daily buffer to changelog. |

### Verification order

`python -m pytest tests/ -v` → `npm run build`

CI runs both on every push/PR to `main`. Data updates (hourly) use `[skip ci]` and deploy to `gh-pages` directly from `update.yml`.

## Architecture

- **Frontend:** Vanilla ES Modules (`scripts/`). No build step, no framework. Hash-based SPA routing (`/#/`, `/#/bundles`).
- **Pipeline:** Python 3.11 scripts (`scripts/`). Crawls GitHub for `.mpp` patch bundles, parses, fingerprints, diffs, writes JSON to `data/`. Zero pip dependencies (stdlib `urllib` only; `Pillow` for image processing, `pytest` for tests).
- **Data layer:** Pipeline outputs static JSON files (`data/core.json`, `data/changes.json`, `data/bundles/`, etc.). Build script copies them to `docs/`, which is pushed to the `gh-pages` branch for GitHub Pages.
- **Hosting:** GitHub Pages serves the `gh-pages` branch (root). CI (GitHub Actions) runs pipeline every hour, commits data changes to `main`, then builds and force-pushes the site to `gh-pages`. Code pushes to `main` trigger the same build+push via `deploy.yml`. The `gh-pages` branch is fully automated — never edit it manually.

### Data flow

```
FETCH → PARSE → DIFF → ACCUMULATE → PUBLISH
```

1. **FETCH**: `fetch_patch_tree.py` + `download_bundles.py` + `fetch_external_repos.py`
2. **PARSE**: `parse_bundles.py` + `fetch_patches_names.py`
3. **DIFF**: `diff_engine.py` (fingerprints + diff) — compares `current_snapshot.json` vs new parse
4. **ACCUMULATE**: `merge_daily_buffer.py` — daily changelog accumulation
5. **PUBLISH**: `generate_site.py` + `telegram.py` — static files, RSS, Telegram notifications

If no changes and no day rollover, pipeline exits silently after step 3. `write_data_files(has_changes=...)` controls what `changes.json` contains — empty when no changes.

## Key gotchas

- **`docs/` is the build output and is gitignored.** `npm run build` generates it. Never edit manually, never commit it. CI pushes it to the `gh-pages` branch.
- **`data/raw/` and `data/output/` are gitignored.** Large generated files.
- **`data/state/` is partially gitignored.** `current_snapshot.json`, `previous_snapshot.json`, `daily_buffer.json`, `external_repos.json`, `last_tg_msg.json` are gitignored. Caches (`app_cache.json`, `last_run.json`, `patches_names_cache.json`, `release_cache.json`) are tracked.
- **CSS is one monolithic file** (`assets/style.css`, ~7000 lines). No CSS modules.
- **SVG icons** are inline strings exported from `scripts/utils/svg.js`. No icon font or library.
- **Python imports** use `sys.path.append` — scripts must run from repo root.
- **No node_modules.** Zero npm dependencies. `npx serve` used for dev/preview only.

## File structure

```
index.html                    — Entry point (vanilla HTML shell)
assets/style.css              — Monolithic CSS (dark theme)
scripts/
  app.js                      — Entry point: boot, router, data loading
  router.js                   — Hash-based SPA router
  store.js                    — Reactive pub/sub state
  ui.js                       — DOM helpers (el, html, mount)
  services/                   — Data fetching, icon cache, IndexedDB
  pages/                      — Page renderers (dashboard, apps, changelog, diff)
  components/                 — Reusable UI (header, footer, modal, skeleton)
  utils/                      — SVG icons, formatting, URL helpers, misc
data/                         — Pipeline output (JSON files)
scripts/ (Python)             — Pipeline scripts (crawl, parse, diff, publish)
```

## Conventions

- Commit messages: conventional commits (`feat`, `fix`, `refactor`, `chore`, etc.) with scopes like `logic`, `ui`, `data`, `pipeline`.
- Vanilla JS: ES modules (`type="module"`), no framework, no build step.
- State management: `store.js` pub/sub pattern (get/set/subscribe).
- Routing: hash-based (`/#/path`), route matching with `:param` support.
- Dark theme only. Color vars in `:root` in `assets/style.css`.
