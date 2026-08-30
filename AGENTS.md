# MorpheTracker — Agent Reference

## Commands

| Task | Command | Notes |
|------|---------|-------|
| Dev server | `npm run dev` | Vite; serves `data/` via custom plugin. Never use `file://`. |
| Typecheck | `npm run typecheck` | `tsc --noEmit`. No linter or formatter configured. |
| Build | `npm run build` | `tsc -b && vite build && node scripts/copy-data-to-dist.js` |
| Run pipeline | `python scripts/run_pipeline.py` | Requires `GITHUB_TOKEN` env var. Installs via `pip install -r requirements.txt`. |
| Manual finalization | `python scripts/merge_daily_buffer.py --finalize` | Force-flush daily buffer to changelog. |

## Architecture

- **Frontend:** React 18 + TypeScript + Vite (`src/`). Single-page app routed by `react-router-dom`.
- **Pipeline:** Python 3.11 scripts (`scripts/`). Crawls GitHub for `.mpp` patch bundles, parses, fingerprints, diffs, writes JSON to `data/`.
- **Data layer:** Pipeline outputs static JSON files (`data/core.json`, `data/changes.json`, `data/bundles/`, etc.). Vite serves them in dev; `copy-data-to-dist.js` copies to `dist/` for production.
- **Hosting:** Vercel serves `dist/` with SPA fallback (`vercel.json`). CI (GitHub Actions) runs pipeline every 3 hours, commits data changes to `main`.

### Data flow

```
GitHub API → download → parse → fingerprint → diff → daily buffer → JSON files → frontend
```

`diff_engine.py` compares `current_snapshot.json` vs new parse. If no changes and no day rollover, pipeline exits silently. `write_data_files(has_changes=...)` controls what `changes.json` contains — empty when no changes.

## Key gotchas

- **No tests, no linter, no formatter.** Only verification is `tsc --noEmit`. Run it before committing TS changes.
- **`dist/` is gitignored.** Vercel builds from source. Do not commit dist/.
- **`data/state/` and `data/raw/` are gitignored** (large generated files). `data/bundles/`, `data/core.json`, `data/changes.json` etc. are tracked.
- **`public/msg.txt`** contains announcements (JSON array). CI includes it in `git add`.
- **CSS is one monolithic file** (`assets/style.css`, ~6000+ lines). No CSS modules.
- **SVG icons** are inline strings exported from `src/utils/svg.ts`. No icon font or library.
- **Python imports** use `sys.path.append` — scripts must run from repo root.
- **`ARCHITECTURE.md` is partially stale** — references old file structure. Trust actual files over it.
- **`snapshots` double-rotation bug was fixed** — `write_data_files()` no longer rotates snapshots; only `update_daily_buffer_run()` does.

## Conventions

- Commit messages: conventional commits (`feat`, `fix`, `refactor`, `chore`, etc.) with scopes like `logic`, `ui`, `data`, `pipeline`.
- React components: functional with hooks, no class components.
- State management: `useReducer` + context (`src/context/AppContext.tsx`).
- Data types: defined in `src/types/` (bundles, api, changes, changelog).
- Dark theme only. Color vars in `:root` in `assets/style.css`.
