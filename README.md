# Morphe Patch Tracker

<p align="center">
    <img src="https://img.shields.io/github/stars/drnx64/morphe-track-patches?style=for-the-badge&logo=github&color=6366f1" alt="GitHub stars">
</p>

An automated compatibility, patch discovery, and update monitoring system for Morphe application patches. This repository monitors multiple patch sources and generates a premium static web dashboard showing compatible apps, release channels, and change history.

This repository was inspired by and built upon concepts from the awesome [awesome-for-morphe](https://github.com/nvbangg/awesome-for-morphe) repository by [@nvbangg](https://github.com/nvbangg).

---

## 🚀 Features

- **Automated Scanning**: Tracks patch bundle releases published to the `Jman-Github/ReVanced-Patch-Bundles` registry.
- **External Repo Discovery**: Fetches community-maintained `repos.txt` from `rushiforai/morphe-archive`, compares it against Jman's bundles, and auto-downloads patch bundles from any external GitHub repos not yet tracked.
- **GitLab & GitHub Support**: Seamlessly parses, validates, and links both GitHub and GitLab source repositories.
- **Multi-channel Monitoring**: Supports both `stable` and `dev` release channels.
- **Smart Change Detection**: Deduplicates consecutive scans via hash-based fingerprints, generating clean historical changelogs.
- **App Icons**: Automatically fetches and caches app icons from Google Play Store.
- **Offline-ready Caching**: Service Worker provides stale-while-revalidate caching for data files and cache-first for static assets.
- **Full Changelog History**: Dedicated changelog viewer with daily rollups of added, updated, and removed apps.

- **Dynamic Web Dashboard**: Beautiful, responsive dark-themed dashboard presenting all patch bundles, compatible apps, and change summaries.
- **Add-to-Source Links**: Dynamic generation of one-click action links to load patch sources directly into the Morphe app.

---

## 📂 Repository Layout

```
MorpheTracker/
├── sw.js                    # Service Worker (stale-while-revalidate + cache-first)
├── assets/                  # CSS styles and static site client JavaScript
├── data/
│   ├── raw/                 # Downloaded registry trees, raw JSON files, and parsed caches
│   ├── state/               # Pipeline execution states, snapshots, buffers, and icon cache
│   ├── output/              # Generated changelog.json and changelog.md
│   ├── repos_list.txt       # All known external repos (owner/repo + GitHub link)
│   └── live.json            # Aggregated database driving the dashboard
├── docs/                    # Optional host location for GH-Pages static website
├── scripts/                 # Core Python pipeline engine scripts
│   ├── fetch_patch_tree.py  # Crawls the central patch bundles tree
│   ├── download_bundles.py  # Filters and downloads Morphe bundle lists
│   ├── parse_bundles.py     # Parses packages, authors, and verifies MPP compatibility
│   ├── icon_fetcher.py      # Scrapes Google Play Store icons with persistent cache
│   ├── fetch_external_repos.py # Discovers & downloads patches from external repos
│   ├── fingerprint_engine.py# Generates bundle hashes to prevent redundant changes
│   ├── diff_engine.py       # Computes additions, updates, and removals of apps
│   ├── merge_daily_buffer.py# Buffers scans and updates statistics (live.json)
│   ├── generate_site.py     # Syncs static files to survive CI checkouts
│   └── run_pipeline.py      # Main entry orchestrator
├── index.html               # Main dashboard web app entry
├── changelog.html           # Historical changelog viewer
└── README.md                # Documentation (this file)
```

---

## ⚙️ Flow Logic & Pipeline Architecture

The update pipeline runs periodically (e.g., via GitHub Actions) and follows these steps:

```mermaid
graph TD
    A[Fetch Registry Tree] -->|fetch_patch_tree.py| B[Tree Output]
    B -->|download_bundles.py| C{Is Morphe Bundle?}
    C -->|No / non-.mpp| D[Skip Bundle]
    C -->|Yes / .mpp| E[Download Bundle & List Json]
    E -->|fetch_external_repos.py| E1{Fetch repos.txt from<br/>morphe-archive}
    E1 --> E2[Parse & compare<br/>against Jman bundles]
    E2 --> E3{Repo already<br/>tracked?}
    E3 -->|Yes| E4[Skip]
    E3 -->|No| E5[Download patches-bundle.json<br/>& patches-list.json<br/>from raw.githubusercontent.com]
    E5 --> E6[Fetch GitHub releases<br/>for stable/dev channels]
    E6 --> E7[Save to data/raw/bundles/<br/>same format as Jman]
    E7 -->|parse_bundles.py| F[Extract Repos & Unique Apps]
    F -->|icon_fetcher.py| G[Enrich with Play Store Icons]
    G -->|fingerprint_engine.py| H[Generate Hashes]
    H -->|diff_engine.py| I{Has Changes?}
    I -->|No & No Rollover| J[Exit Silently]
    I -->|Yes| K[Update Daily Buffer]
    K -->|merge_daily_buffer.py| L[Update live.json + changelog.json]
    L -->|generate_site.py| N[Sync Static Files]
    N -->|sw.js| O[Service Worker Caches Data]
```

### 1. File Discovery (`fetch_patch_tree.py`)
Queries the GitHub Git Trees API for `Jman-Github/ReVanced-Patch-Bundles` recursive tree on the `bundles` branch. It stores the metadata of all discovered files under `patch-bundles/` in `tree.json`.

### 2. Downloader & Filter (`download_bundles.py`)
Iterates over the discovered tree. It parses `patches-bundle.json` files and performs the critical check:
- If a bundle's `download_url` points to a `.mpp` binary (Morphe Patch Package) and matches the correct structure, it proceeds. Otherwise, it is skipped.
- Downloads files into `data/raw/bundles/<bundle_name>/<channel>/` locally.

### 2b. External Repo Discovery (`fetch_external_repos.py`)
A supplementary step that broadens coverage beyond Jman's central registry:

- Fetches `repos.txt` from the community [`rushiforai/morphe-archive`](https://github.com/rushiforai/morphe-archive) — a curated list of all known Morphe patch repositories.
- Scans the already-downloaded `data/raw/bundles/` directory to build a set of repo URLs already present in Jman's bundles.
- Filters out repos that are already tracked, and skips known non-patch repos (e.g., `builder-for-morphe`, `awesome-revanced`).
- For each untracked repo:
  1. Fetches `patches-bundle.json` and `patches-list.json` directly from `raw.githubusercontent.com` (tries `main`, then `master`).
  2. Validates the bundle has a `.mpp` download URL.
  3. Fetches GitHub releases via the API to determine stable vs. dev channel and version tags.
  4. Writes the bundle files into `data/raw/bundles/<slug>/<channel>/` — the exact same directory structure used by Jman bundles.
- Saves/refreshes `data/repos_list.txt` — a local text file listing all known repos with their `owner/repo -> https://github.com/owner/repo` mapping and a sortable list of every tracked repo.

**Key insight:** Once external repos are downloaded, they are treated identically to Jman bundles by every downstream pipeline step (parsing, fingerprinting, diffing, merging, dashboard rendering). The pipeline does not distinguish between a bundle that came from the central registry vs. an external repo.

---

### 3. Parser & Icon Enrichment (`parse_bundles.py` & `icon_fetcher.py`)
Parses downloaded bundles, checks package compatibility lists (`compatiblePackages`), maps package identifiers to user-friendly titles, and extracts the correct repository URLs and usernames by parsing the release's `download_url`. Each app is then enriched with a Google Play Store icon by scraping the `og:image` meta tag; results are cached in `data/state/icon_cache.json` to avoid re-scraping every pipeline run.

### 4. Fingerprint & Diff (`fingerprint_engine.py` & `diff_engine.py`)
Computes SHA-256 hashes of the parsed files. It compares the current scan snapshot with the previous snapshot:
- Detects if any bundle versions have been upgraded/downgraded.
- Detects if any compatible applications have been added, updated, or removed.

### 5. Finalizer (`merge_daily_buffer.py`)
Consolidates changes within a 24-hour window to keep notifications clean. It computes global statistics:
- **Total Bundles**: Counts unique bundles by checking name and repository (stable and dev release channels under the same bundle name and repo count as **1**).
- **Total Apps**: Counts unique app package names across all bundles.
- Saves the database output to `data/core.json`, `data/stats.json`, `data/changes.json`, and `data/bundles.json`.

### 6. Static Site Sync (`generate_site.py`)
Reads files from disk and writes them back to preserve them during CI checkouts. Also copies `changelog.json` to `data/changelog.json` for the web frontend. The actual working static files are maintained directly on disk — this script simply ensures they survive a fresh GitHub Actions checkout.

---

## 👏 Credits

### Inspiration
- [@nvbangg](https://github.com/nvbangg) — [awesome-for-morphe](https://github.com/nvbangg/awesome-for-morphe) served as the template and inspiration for this dashboard.
- [@rushiforai](https://github.com/rushiforai) — [morphe-archive](https://github.com/rushiforai/morphe-archive) maintains the community `repos.txt` that feeds the external repo discovery.

### Central Registry
- [@Jman-Github](https://github.com/Jman-Github) — [ReVanced-Patch-Bundles](https://github.com/Jman-Github/ReVanced-Patch-Bundles) is the primary upstream registry.

### All Patch Authors

Thanks to every developer who publishes Morphe patches. The full up-to-date list is maintained in [`data/repos_list.txt`](data/repos_list.txt) (147 repos), including:

| # | Repo | Author |
|---|------|--------|
| 1 | [abhis1n/Morphe-Patches](https://github.com/abhis1n/Morphe-Patches) | [@abhis1n](https://github.com/abhis1n) |
| 2 | [ajstrick81/morphe-androidtv-patches](https://github.com/ajstrick81/morphe-androidtv-patches) | [@ajstrick81](https://github.com/ajstrick81) |
| 3 | [alan7383/sofatime-patches](https://github.com/alan7383/sofatime-patches) | [@alan7383](https://github.com/alan7383) |
| 4 | [Alastor-Kaneki/Morphe-Patches](https://github.com/Alastor-Kaneki/Morphe-Patches) | [@Alastor-Kaneki](https://github.com/Alastor-Kaneki) |
| 5 | [alejandrobellver/pichiwa-patches](https://github.com/alejandrobellver/pichiwa-patches) | [@alejandrobellver](https://github.com/alejandrobellver) |
| 6 | [AlexNaga/android-patches](https://github.com/AlexNaga/android-patches) | [@AlexNaga](https://github.com/AlexNaga) |
| 7 | [Almewty/my-morphe-patches](https://github.com/Almewty/my-morphe-patches) | [@Almewty](https://github.com/Almewty) |
| 8 | [ameenalasady/ameen-morphe](https://github.com/ameenalasady/ameen-morphe) | [@ameenalasady](https://github.com/ameenalasady) |
| 9 | [ameenalasady/photogrid-morphe](https://github.com/ameenalasady/photogrid-morphe) | [@ameenalasady](https://github.com/ameenalasady) |
| 10 | [AmpleReVanced/revanced-patches](https://github.com/AmpleReVanced/revanced-patches) | [@AmpleReVanced](https://github.com/AmpleReVanced) |
| 11 | [anddea/revanced-patches](https://github.com/anddea/revanced-patches) | [@anddea](https://github.com/anddea) |
| 12 | [andrewliang25/morphe-patches](https://github.com/andrewliang25/morphe-patches) | [@andrewliang25](https://github.com/andrewliang25) |
| 13 | [andronedev/morphe-patches](https://github.com/andronedev/morphe-patches) | [@andronedev](https://github.com/andronedev) |
| 14 | [andronedev/morphe-portal-patch](https://github.com/andronedev/morphe-portal-patch) | [@andronedev](https://github.com/andronedev) |
| 15 | [arandomhooman/hoomans-morphe-patches](https://github.com/arandomhooman/hoomans-morphe-patches) | [@arandomhooman](https://github.com/arandomhooman) |
| 16 | [ARHCOS/arhcos-patches](https://github.com/ARHCOS/arhcos-patches) | [@ARHCOS](https://github.com/ARHCOS) |
| 17 | [ariecos/gemini-patches](https://github.com/ariecos/gemini-patches) | [@ariecos](https://github.com/ariecos) |
| 18 | [arunpdl/morphe-patches](https://github.com/arunpdl/morphe-patches) | [@arunpdl](https://github.com/arunpdl) |
| 19 | [babyhuehnchen/morphe-patches](https://github.com/babyhuehnchen/morphe-patches) | [@babyhuehnchen](https://github.com/babyhuehnchen) |
| 20 | [bdgerszewski/morphe-patches-ihealth](https://github.com/bdgerszewski/morphe-patches-ihealth) | [@bdgerszewski](https://github.com/bdgerszewski) |
| 21 | [bernardo7894/remove-permaban-banner-patch](https://github.com/bernardo7894/remove-permaban-banner-patch) | [@bernardo7894](https://github.com/bernardo7894) |
| 22 | [BholeyKaBhakt/android-patches-xtra](https://github.com/BholeyKaBhakt/android-patches-xtra) | [@BholeyKaBhakt](https://github.com/BholeyKaBhakt) |
| 23 | [bigyank/morphe-patches-samsung](https://github.com/bigyank/morphe-patches-samsung) | [@bigyank](https://github.com/bigyank) |
| 24 | [binarymend/morphe-patches](https://github.com/binarymend/morphe-patches) | [@binarymend](https://github.com/binarymend) |
| 25 | [brosssh/morphe-patches](https://github.com/brosssh/morphe-patches) | [@brosssh](https://github.com/brosssh) |
| 26 | [browzomje/browzomje-patches](https://github.com/browzomje/browzomje-patches) | [@browzomje](https://github.com/browzomje) |
| 27 | [bufferk/morphe-patches](https://github.com/bufferk/morphe-patches) | [@bufferk](https://github.com/bufferk) |
| 28 | [byehi98/okish-morphe-patches](https://github.com/byehi98/okish-morphe-patches) | [@byehi98](https://github.com/byehi98) |
| 29 | [cesbar/zpatches](https://github.com/cesbar/zpatches) | [@cesbar](https://github.com/cesbar) |
| 30 | [ch3thanhs/stylus](https://github.com/ch3thanhs/stylus) | [@ch3thanhs](https://github.com/ch3thanhs) |
| 31 | [chirag127/morphe-patches](https://github.com/chirag127/morphe-patches) | [@chirag127](https://github.com/chirag127) |
| 32 | [chukfinley/tidal-patches](https://github.com/chukfinley/tidal-patches) | [@chukfinley](https://github.com/chukfinley) |
| 33 | [ciraolone/morphe-watch-later](https://github.com/ciraolone/morphe-watch-later) | [@ciraolone](https://github.com/ciraolone) |
| 34 | [claviola/morphe-patches-nl](https://github.com/claviola/morphe-patches-nl) | [@claviola](https://github.com/claviola) |
| 35 | [crimera/piko](https://github.com/crimera/piko) | [@crimera](https://github.com/crimera) |
| 36 | [d0nj/morphe-patches](https://github.com/d0nj/morphe-patches) | [@d0nj](https://github.com/d0nj) |
| 37 | [david419kr/niconico-yt-morphe-patches](https://github.com/david419kr/niconico-yt-morphe-patches) | [@david419kr](https://github.com/david419kr) |
| 38 | [dexnis-dev/morphe-patches](https://github.com/dexnis-dev/morphe-patches) | [@dexnis-dev](https://github.com/dexnis-dev) |
| 39 | [dh6k/morphe-patches](https://github.com/dh6k/morphe-patches) | [@dh6k](https://github.com/dh6k) |
| 40 | [docbt/patched-up](https://github.com/docbt/patched-up) | [@docbt](https://github.com/docbt) |
| 41 | [drosoCode/morphe-patches](https://github.com/drosoCode/morphe-patches) | [@drosoCode](https://github.com/drosoCode) |
| 42 | [dumb-software/T2C-App-Patch-Morphe](https://github.com/dumb-software/T2C-App-Patch-Morphe) | [@dumb-software](https://github.com/dumb-software) |
| 43 | [durgesh0505/chiggi_morphe_patches](https://github.com/durgesh0505/chiggi_morphe_patches) | [@durgesh0505](https://github.com/durgesh0505) |
| 44 | [Entree3k/Morning-Entree-Patches](https://github.com/Entree3k/Morning-Entree-Patches) | [@Entree3k](https://github.com/Entree3k) |
| 45 | [ethanm6/letterboxd-stremio-morphe-patch](https://github.com/ethanm6/letterboxd-stremio-morphe-patch) | [@ethanm6](https://github.com/ethanm6) |
| 46 | [eyalm2000/tidal-debug-menu](https://github.com/eyalm2000/tidal-debug-menu) | [@eyalm2000](https://github.com/eyalm2000) |
| 47 | [eZ4RK0/morphe-patches](https://github.com/eZ4RK0/morphe-patches) | [@eZ4RK0](https://github.com/eZ4RK0) |
| 48 | [fangkampanat/gmaps-patches](https://github.com/fangkampanat/gmaps-patches) | [@fangkampanat](https://github.com/fangkampanat) |
| 49 | [franticg33k/morphe-patches](https://github.com/franticg33k/morphe-patches) | [@franticg33k](https://github.com/franticg33k) |
| 50 | [furkngld/tiktok-lite-patches-for-morphe](https://github.com/furkngld/tiktok-lite-patches-for-morphe) | [@furkngld](https://github.com/furkngld) |
| 51 | [gitlab.com/early.egg3707](https://github.com/gitlab.com/early.egg3707) | [@gitlab.com](https://github.com/gitlab.com) |
| 52 | [gitlab.com/inotia00](https://github.com/gitlab.com/inotia00) | [@gitlab.com](https://github.com/gitlab.com) |
| 53 | [gitlab.com/inotia00](https://github.com/gitlab.com/inotia00) | [@gitlab.com](https://github.com/gitlab.com) |
| 54 | [gitlab.com/Paresh-Maheshwari](https://github.com/gitlab.com/Paresh-Maheshwari) | [@gitlab.com](https://github.com/gitlab.com) |
| 55 | [GoldRift/morphe-patches](https://github.com/GoldRift/morphe-patches) | [@GoldRift](https://github.com/GoldRift) |
| 56 | [Graywizard888/Enhancify](https://github.com/Graywizard888/Enhancify) | [@Graywizard888](https://github.com/Graywizard888) |
| 57 | [hackingguy/morphe-patches](https://github.com/hackingguy/morphe-patches) | [@hackingguy](https://github.com/hackingguy) |
| 58 | [heinrich26/morphe-patches](https://github.com/heinrich26/morphe-patches) | [@heinrich26](https://github.com/heinrich26) |
| 59 | [HellveticaStandard/HellveticaPatches](https://github.com/HellveticaStandard/HellveticaPatches) | [@HellveticaStandard](https://github.com/HellveticaStandard) |
| 60 | [Hiosdra/morphe-patches](https://github.com/Hiosdra/morphe-patches) | [@Hiosdra](https://github.com/Hiosdra) |
| 61 | [hoo-dles/jadx-morphe](https://github.com/hoo-dles/jadx-morphe) | [@hoo-dles](https://github.com/hoo-dles) |
| 62 | [hoo-dles/morphe-patches](https://github.com/hoo-dles/morphe-patches) | [@hoo-dles](https://github.com/hoo-dles) |
| 63 | [hu-liberator/patches](https://github.com/hu-liberator/patches) | [@hu-liberator](https://github.com/hu-liberator) |
| 64 | [humzakh/HK-Morphe-Patches](https://github.com/humzakh/HK-Morphe-Patches) | [@humzakh](https://github.com/humzakh) |
| 65 | [HvQ/eksi-morphe](https://github.com/HvQ/eksi-morphe) | [@HvQ](https://github.com/HvQ) |
| 66 | [hxreborn/morphe-patches](https://github.com/hxreborn/morphe-patches) | [@hxreborn](https://github.com/hxreborn) |
| 67 | [icysymmetra/tiktok-patches-for-morphe](https://github.com/icysymmetra/tiktok-patches-for-morphe) | [@icysymmetra](https://github.com/icysymmetra) |
| 68 | [Ikuradachi/ikura-patches](https://github.com/Ikuradachi/ikura-patches) | [@Ikuradachi](https://github.com/Ikuradachi) |
| 69 | [ilikeadofai/vocacolle-morphe-patches](https://github.com/ilikeadofai/vocacolle-morphe-patches) | [@ilikeadofai](https://github.com/ilikeadofai) |
| 70 | [ImmortalZeus/ImmortalZeus-Morphe-Patches](https://github.com/ImmortalZeus/ImmortalZeus-Morphe-Patches) | [@ImmortalZeus](https://github.com/ImmortalZeus) |
| 71 | [IMXEren/mix-patches](https://github.com/IMXEren/mix-patches) | [@IMXEren](https://github.com/IMXEren) |
| 72 | [isuruhg/fin-tweaks](https://github.com/isuruhg/fin-tweaks) | [@isuruhg](https://github.com/isuruhg) |
| 73 | [itsthejoker/itsthejoker-patches](https://github.com/itsthejoker/itsthejoker-patches) | [@itsthejoker](https://github.com/itsthejoker) |
| 74 | [jasonwu1994/Gboard-patches](https://github.com/jasonwu1994/Gboard-patches) | [@jasonwu1994](https://github.com/jasonwu1994) |
| 75 | [jkennethcarino/adobo](https://github.com/jkennethcarino/adobo) | [@jkennethcarino](https://github.com/jkennethcarino) |
| 76 | [Jl4cTuk/morphe-patches](https://github.com/Jl4cTuk/morphe-patches) | [@Jl4cTuk](https://github.com/Jl4cTuk) |
| 77 | [Jman-Github/Awesome-ReVanced](https://github.com/Jman-Github/Awesome-ReVanced) | [@Jman-Github](https://github.com/Jman-Github) |
| 78 | [Jman-Github/ReVanced-Patch-Bundles](https://github.com/Jman-Github/ReVanced-Patch-Bundles) | [@Jman-Github](https://github.com/Jman-Github) |
| 79 | [Jman-Github/Universal-ReVanced-Manager](https://github.com/Jman-Github/Universal-ReVanced-Manager) | [@Jman-Github](https://github.com/Jman-Github) |
| 80 | [JonnyVR1/morph-patches](https://github.com/JonnyVR1/morph-patches) | [@JonnyVR1](https://github.com/JonnyVR1) |
| 81 | [Joristdh/Platypatch](https://github.com/Joristdh/Platypatch) | [@Joristdh](https://github.com/Joristdh) |
| 82 | [Joussflls10/Jouss-Patches](https://github.com/Joussflls10/Jouss-Patches) | [@Joussflls10](https://github.com/Joussflls10) |
| 83 | [kareemlukitomo/morphe-patches](https://github.com/kareemlukitomo/morphe-patches) | [@kareemlukitomo](https://github.com/kareemlukitomo) |
| 84 | [kiraio-moe/Lain-Patches](https://github.com/kiraio-moe/Lain-Patches) | [@kiraio-moe](https://github.com/kiraio-moe) |
| 85 | [kolaron/morphe-patches](https://github.com/kolaron/morphe-patches) | [@kolaron](https://github.com/kolaron) |
| 86 | [kondratjev/morphe-patches](https://github.com/kondratjev/morphe-patches) | [@kondratjev](https://github.com/kondratjev) |
| 87 | [kontsevoye/emorphe-patches](https://github.com/kontsevoye/emorphe-patches) | [@kontsevoye](https://github.com/kontsevoye) |
| 88 | [kun-codes/npci-bhim-morphe-patches](https://github.com/kun-codes/npci-bhim-morphe-patches) | [@kun-codes](https://github.com/kun-codes) |
| 89 | [LaBlazer/morphe-patches](https://github.com/LaBlazer/morphe-patches) | [@LaBlazer](https://github.com/LaBlazer) |
| 90 | [LaKakaReal/LaKakaShitPatches](https://github.com/LaKakaReal/LaKakaShitPatches) | [@LaKakaReal](https://github.com/LaKakaReal) |
| 91 | [liongalahad/nuviotv-morphe-patches](https://github.com/liongalahad/nuviotv-morphe-patches) | [@liongalahad](https://github.com/liongalahad) |
| 92 | [liongalahad/nuviotv-patches](https://github.com/liongalahad/nuviotv-patches) | [@liongalahad](https://github.com/liongalahad) |
| 93 | [logm1lo/logm1lo-patches](https://github.com/logm1lo/logm1lo-patches) | [@logm1lo](https://github.com/logm1lo) |
| 94 | [loskutov/youtube-domain-fronting-patch](https://github.com/loskutov/youtube-domain-fronting-patch) | [@loskutov](https://github.com/loskutov) |
| 95 | [Lynx6319/patch-youtube-scroll-block](https://github.com/Lynx6319/patch-youtube-scroll-block) | [@Lynx6319](https://github.com/Lynx6319) |
| 96 | [lyyako/realme-link-patches](https://github.com/lyyako/realme-link-patches) | [@lyyako](https://github.com/lyyako) |
| 97 | [MarcaDian/morphe-patches-yavot](https://github.com/MarcaDian/morphe-patches-yavot) | [@MarcaDian](https://github.com/MarcaDian) |
| 98 | [meridianfresco/morphe-meta-patches](https://github.com/meridianfresco/morphe-meta-patches) | [@meridianfresco](https://github.com/meridianfresco) |
| 99 | [MiguelNinja19/miguel-morphe-patches](https://github.com/MiguelNinja19/miguel-morphe-patches) | [@MiguelNinja19](https://github.com/MiguelNinja19) |
| 100 | [MoonShadowKeeper/Telegram-patchesMorphe](https://github.com/MoonShadowKeeper/Telegram-patchesMorphe) | [@MoonShadowKeeper](https://github.com/MoonShadowKeeper) |
| 101 | [MorpheApp/morphe-patches](https://github.com/MorpheApp/morphe-patches) | [@MorpheApp](https://github.com/MorpheApp) |
| 102 | [mxkrgt/dbtcoach-morphe-patches](https://github.com/mxkrgt/dbtcoach-morphe-patches) | [@mxkrgt](https://github.com/mxkrgt) |
| 103 | [Nai64/Nai64Patches](https://github.com/Nai64/Nai64Patches) | [@Nai64](https://github.com/Nai64) |
| 104 | [NekoGryphou/gryphous-morphe-patches](https://github.com/NekoGryphou/gryphous-morphe-patches) | [@NekoGryphou](https://github.com/NekoGryphou) |
| 105 | [nosini/disable-shorts-repeat](https://github.com/nosini/disable-shorts-repeat) | [@nosini](https://github.com/nosini) |
| 106 | [nvbangg/builder-for-morphe](https://github.com/nvbangg/builder-for-morphe) | [@nvbangg](https://github.com/nvbangg) |
| 107 | [osirisad/teamsnap-patches](https://github.com/osirisad/teamsnap-patches) | [@osirisad](https://github.com/osirisad) |
| 108 | [osirisad/ts-patches](https://github.com/osirisad/ts-patches) | [@osirisad](https://github.com/osirisad) |
| 109 | [Pa-kon/morphe-screenshot-patches](https://github.com/Pa-kon/morphe-screenshot-patches) | [@Pa-kon](https://github.com/Pa-kon) |
| 110 | [Paresh-Maheshwari/patch-explorer](https://github.com/Paresh-Maheshwari/patch-explorer) | [@Paresh-Maheshwari](https://github.com/Paresh-Maheshwari) |
| 111 | [PawiX25/pepper-morphe-patches](https://github.com/PawiX25/pepper-morphe-patches) | [@PawiX25](https://github.com/PawiX25) |
| 112 | [PixelPusher247/morphe-patches](https://github.com/PixelPusher247/morphe-patches) | [@PixelPusher247](https://github.com/PixelPusher247) |
| 113 | [polka-bear/morphe-patches](https://github.com/polka-bear/morphe-patches) | [@polka-bear](https://github.com/polka-bear) |
| 114 | [PrathxmOp/Prathxm-Patches](https://github.com/PrathxmOp/Prathxm-Patches) | [@PrathxmOp](https://github.com/PrathxmOp) |
| 115 | [PrathxmOp/ytmusic-patches](https://github.com/PrathxmOp/ytmusic-patches) | [@PrathxmOp](https://github.com/PrathxmOp) |
| 116 | [pseudofractal/morphe-patches](https://github.com/pseudofractal/morphe-patches) | [@pseudofractal](https://github.com/pseudofractal) |
| 117 | [quantavil/edge-morphe-patches](https://github.com/quantavil/edge-morphe-patches) | [@quantavil](https://github.com/quantavil) |
| 118 | [Quantro100/Morphe-patches](https://github.com/Quantro100/Morphe-patches) | [@Quantro100](https://github.com/Quantro100) |
| 119 | [RealCyberwash/max-patches](https://github.com/RealCyberwash/max-patches) | [@RealCyberwash](https://github.com/RealCyberwash) |
| 120 | [Ripthulhu/morphe-google-patches](https://github.com/Ripthulhu/morphe-google-patches) | [@Ripthulhu](https://github.com/Ripthulhu) |
| 121 | [RookieEnough/De-Vanced](https://github.com/RookieEnough/De-Vanced) | [@RookieEnough](https://github.com/RookieEnough) |
| 122 | [RoundSalmon4/morphe-patches-template](https://github.com/RoundSalmon4/morphe-patches-template) | [@RoundSalmon4](https://github.com/RoundSalmon4) |
| 123 | [rushiranpise/RI-Vanced-Universal-Morphe-Patches](https://github.com/rushiranpise/RI-Vanced-Universal-Morphe-Patches) | [@rushiranpise](https://github.com/rushiranpise) |
| 124 | [rushiranpise/Ri-Vanced-Universal-Morphe-Patches](https://github.com/rushiranpise/Ri-Vanced-Universal-Morphe-Patches) | [@rushiranpise](https://github.com/rushiranpise) |
| 125 | [saieshshirodkar/saiesh-morphe-patches](https://github.com/saieshshirodkar/saiesh-morphe-patches) | [@saieshshirodkar](https://github.com/saieshshirodkar) |
| 126 | [Seobject/Seobject-patches](https://github.com/Seobject/Seobject-patches) | [@Seobject](https://github.com/Seobject) |
| 127 | [shaun-the-sheep-patches/morphe-patches](https://github.com/shaun-the-sheep-patches/morphe-patches) | [@shaun-the-sheep-patches](https://github.com/shaun-the-sheep-patches) |
| 128 | [sjshb57/Pairip-Patches](https://github.com/sjshb57/Pairip-Patches) | [@sjshb57](https://github.com/sjshb57) |
| 129 | [skulldogged/cobalt-morphe](https://github.com/skulldogged/cobalt-morphe) | [@skulldogged](https://github.com/skulldogged) |
| 130 | [SouBryan/pinterest-morphed](https://github.com/SouBryan/pinterest-morphed) | [@SouBryan](https://github.com/SouBryan) |
| 131 | [spookyexe/morphe-patches](https://github.com/spookyexe/morphe-patches) | [@spookyexe](https://github.com/spookyexe) |
| 132 | [TheRealCrazyfuy/abeja-morphe-patches](https://github.com/TheRealCrazyfuy/abeja-morphe-patches) | [@TheRealCrazyfuy](https://github.com/TheRealCrazyfuy) |
| 133 | [tiaruebar1024/tiaruebar-patches](https://github.com/tiaruebar1024/tiaruebar-patches) | [@tiaruebar1024](https://github.com/tiaruebar1024) |
| 134 | [Tornillo2/movistar-block-ads-morphe](https://github.com/Tornillo2/movistar-block-ads-morphe) | [@Tornillo2](https://github.com/Tornillo2) |
| 135 | [totsiaw/proxma-patches](https://github.com/totsiaw/proxma-patches) | [@totsiaw](https://github.com/totsiaw) |
| 136 | [Trimpsuz/morphe-busuu](https://github.com/Trimpsuz/morphe-busuu) | [@Trimpsuz](https://github.com/Trimpsuz) |
| 137 | [Utsavrajputt/Modx-patches](https://github.com/Utsavrajputt/Modx-patches) | [@Utsavrajputt](https://github.com/Utsavrajputt) |
| 138 | [variablenine/morphe-patches](https://github.com/variablenine/morphe-patches) | [@variablenine](https://github.com/variablenine) |
| 139 | [vladon/morphe-patches-navi](https://github.com/vladon/morphe-patches-navi) | [@vladon](https://github.com/vladon) |
| 140 | [wchill/anddea-rvx-morphed](https://github.com/wchill/anddea-rvx-morphed) | [@wchill](https://github.com/wchill) |
| 141 | [wchill/patcheddit](https://github.com/wchill/patcheddit) | [@wchill](https://github.com/wchill) |
| 142 | [wchill/rvx-morphed](https://github.com/wchill/rvx-morphed) | [@wchill](https://github.com/wchill) |
| 143 | [WZSE/morphe-patches](https://github.com/WZSE/morphe-patches) | [@WZSE](https://github.com/WZSE) |
| 144 | [Xhehab/Xhehab-Patches](https://github.com/Xhehab/Xhehab-Patches) | [@Xhehab](https://github.com/Xhehab) |
| 145 | [Xisrr1/Revancify-Xisr](https://github.com/Xisrr1/Revancify-Xisr) | [@Xisrr1](https://github.com/Xisrr1) |
| 146 | [xob0t/morphe-patches](https://github.com/xob0t/morphe-patches) | [@xob0t](https://github.com/xob0t) |
| 147 | [ynotzort/morphe-patches](https://github.com/ynotzort/morphe-patches) | [@ynotzort](https://github.com/ynotzort) |

Missing or new? Check [`data/repos_list.txt`](data/repos_list.txt) for the most current list.

---

## Star History


<a href="https://www.star-history.com/?type=date&repos=drnx64%2Fmorphe-track-patches">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=drnx64/morphe-track-patches&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=drnx64/morphe-track-patches&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=drnx64/morphe-track-patches&type=date&legend=top-left" />
 </picture>
</a>

---

*Built with ❤️ for the Morphe community.*
