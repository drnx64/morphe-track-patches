<p align="center">
  <img src="assets/banner.svg" alt="Morphe Patch Tracker" width="100%">
</p>

<h1 align="center">Morphe Patch Tracker</h1>

<p align="center">
  <em>Automated compatibility, patch discovery & update monitoring for Morphe patches</em>
</p>

<p align="center">
  <a href="https://morphe-patches-drnx64.vercel.app/">
    <img src="https://img.shields.io/badge/Live_Demo-morphe--patches--drnx64.vercel.app-6366f1?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo">
  </a>
  <br>
  <img src="https://img.shields.io/github/actions/workflow/status/drnx64/morphe-track-patches/ci.yml?style=flat-square&logo=github&label=CI&color=6366f1" alt="CI">
  <img src="https://img.shields.io/github/license/drnx64/morphe-track-patches?style=flat-square&color=22c55e" alt="License">
  <img src="https://img.shields.io/github/stars/drnx64/morphe-track-patches?style=flat-square&logo=github&color=eab308" alt="Stars">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square" alt="PRs Welcome">
  <img src="https://img.shields.io/badge/python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/node-18+-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node">
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white" alt="Vercel">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/210+-patch_sources-8b5cf6?style=for-the-badge&logo=github&logoColor=white" alt="Patch Sources">
  <img src="https://img.shields.io/badge/Auto_Scan-every_3h-06b6d4?style=for-the-badge&logo=github-actions&logoColor=white" alt="Auto Scan">
  <img src="https://img.shields.io/badge/Dashboard-Dark_Theme-1e293b?style=for-the-badge&logo=react&logoColor=white" alt="Dashboard">
</p>

---

## What is this?

Morphe Patch Tracker monitors the Morphe patch ecosystem — tracking **210+ patch sources** across GitHub and GitLab, detecting compatibility changes, and presenting everything in a real-time dashboard. The pipeline runs every **3 hours** via GitHub Actions, auto-discovers new patch authors, and generates a static site hosted on Vercel.

Inspired by [awesome-for-morphe](https://github.com/nvbangg/awesome-for-morphe) by [@nvbangg](https://github.com/nvbangg).

---

## Features

<table>
<tr>
<td width="50%">

### Pipeline

- **Automated Scanning** — tracks `Jman-Github/ReVanced-Patch-Bundles` registry
- **External Repo Discovery** — fetches community `repos.txt` from `rushiforai/morphe-archive`
- **GitLab & GitHub Support** — parses both seamlessly
- **Multi-channel** — `stable` and `dev` release channels
- **Smart Dedup** — hash-based fingerprints prevent redundant changes

</td>
<td width="50%">

### Dashboard

- **Dynamic Web App** — responsive dark-themed React SPA
- **App Icons** — auto-fetched from Google Play Store with persistent cache
- **Add-to-Source Links** — one-click action links into Morphe app
- **Full Changelog** — daily rollups of added, updated, removed apps
- **Offline-ready** — Service Worker with stale-while-revalidate caching

</td>
</tr>
</table>

---

## Tech Stack

<table>
<tr>
<td align="center" width="14%">
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg" width="40"><br>
  <strong>React 18</strong><br>
  <sub>UI Framework</sub>
</td>
<td align="center" width="14%">
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg" width="40"><br>
  <strong>TypeScript 5</strong><br>
  <sub>Type Safety</sub>
</td>
<td align="center" width="14%">
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vitejs/vitejs-original.svg" width="40"><br>
  <strong>Vite 5</strong><br>
  <sub>Build Tool</sub>
</td>
<td align="center" width="14%">
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg" width="40"><br>
  <strong>Python 3.11</strong><br>
  <sub>Pipeline Engine</sub>
</td>
<td align="center" width="14%">
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg" width="40"><br>
  <strong>GitHub Actions</strong><br>
  <sub>CI/CD</sub>
</td>
<td align="center" width="14%">
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vercel/vercel-original.svg" width="40"><br>
  <strong>Vercel</strong><br>
  <sub>Hosting</sub>
</td>
</tr>
</table>

---

## Quick Start

```bash
# Clone
git clone https://github.com/drnx64/morphe-track-patches.git
cd morphe-track-patches

# Install dependencies
npm install

# Start dev server (serves data/ via Vite plugin)
npm run dev

# In another terminal — run the pipeline (needs GITHUB_TOKEN)
export GITHUB_TOKEN=ghp_...
python scripts/run_pipeline.py
```

> The dev server uses a custom Vite plugin to serve `data/` files. Never use `file://` — always use `npm run dev`.

---

## How It Works

The pipeline runs every 3 hours and follows these steps:

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

### Pipeline Steps

| # | Step | Script | What it does |
|---|------|--------|-------------|
| 1 | **Discovery** | `fetch_patch_tree.py` | Crawls `Jman-Github/ReVanced-Patch-Bundles` via GitHub Git Trees API |
| 2 | **Download** | `download_bundles.py` | Filters `.mpp` bundles, downloads with skip cache + atomic swap |
| 2b | **External** | `fetch_external_repos.py` | Fetches community `repos.txt`, discovers untracked patch sources |
| 3 | **Parse** | `parse_bundles.py` | Extracts repos, apps, compatibility lists from bundles |
| 4 | **Icons** | `icon_fetcher.py` | Scrapes Google Play Store icons with persistent cache |
| 5 | **Diff** | `diff_engine.py` | SHA-256 fingerprints, detects additions/updates/removals |
| 6 | **Merge** | `merge_daily_buffer.py` | 24h change windowing, computes stats, writes `core.json` |
| 7 | **Sync** | `generate_site.py` | Preserves files across CI checkouts |

### Data Flow

```
GitHub API → download → parse → fingerprint → diff → daily buffer → JSON files → frontend
```

---

## Repository Layout

```
MorpheTracker/
├── src/                    # React frontend (TypeScript)
│   ├── components/         #   UI components
│   ├── context/            #   AppContext with useReducer
│   ├── hooks/              #   useDataFetching, useEntries
│   ├── services/           #   fetchData, iconCache, indexedDB
│   ├── types/              #   Bundle, Changes, API types
│   └── utils/              #   SVG icons, helpers
├── scripts/                # Python pipeline engine
│   ├── run_pipeline.py     #   Main orchestrator
│   ├── fetch_patch_tree.py #   Registry tree crawler
│   ├── download_bundles.py #   Bundle downloader + skip cache
│   ├── parse_bundles.py    #   Bundle parser
│   ├── icon_fetcher.py     #   Play Store icon scraper
│   ├── diff_engine.py      #   Change detection + badges
│   ├── merge_daily_buffer.py # Change windowing + stats
│   └── config.py           #   Shared constants
├── data/                   # Generated JSON (tracked)
│   ├── bundles/            #   Per-bundle metadata
│   ├── core.json           #   Aggregated app data
│   ├── changes.json        #   Latest detected changes
│   ├── stats.json          #   Global statistics
│   └── state/              #   Pipeline state (gitignored)
├── assets/                 # CSS styles (~6000 lines)
├── public/                 # Service worker, favicon, msg.txt
├── tests/                  # 30 pytest tests
├── .github/workflows/      # CI checks + auto-update pipeline
├── index.html              # Dashboard entry point
└── vercel.json             # SPA fallback routing
```

---

## Credits

<details>
<summary><strong>All Patch Authors</strong> — 210+ repos and growing</summary>

Thanks to every developer who publishes Morphe patches. The full up-to-date list is maintained in [`data/repos_list.txt`](data/repos_list.txt).

| # | Repo | Author |
|---|------|--------|
| 1 | [6ixfalls/revanced-patches](https://github.com/6ixfalls/revanced-patches) | [@6ixfalls](https://github.com/6ixfalls) |
| 2 | [abhis1n/Morphe-Patches](https://github.com/abhis1n/Morphe-Patches) | [@abhis1n](https://github.com/abhis1n) |
| 3 | [adderalladmiral/psychonaut-wiki-journal-patches](https://github.com/adderalladmiral/psychonaut-wiki-journal-patches) | [@adderalladmiral](https://github.com/adderalladmiral) |
| 4 | [ahmedyarub/morphe-patches](https://github.com/ahmedyarub/morphe-patches) | [@ahmedyarub](https://github.com/ahmedyarub) |
| 5 | [ajstrick81/morphe-androidtv-patches](https://github.com/ajstrick81/morphe-androidtv-patches) | [@ajstrick81](https://github.com/ajstrick81) |
| 6 | [Akash-Sriram/De-Vanced](https://github.com/Akash-Sriram/De-Vanced) | [@Akash-Sriram](https://github.com/Akash-Sriram) |
| 7 | [alalloush/xperia-1v-camera-patches](https://github.com/alalloush/xperia-1v-camera-patches) | [@alalloush](https://github.com/alalloush) |
| 8 | [alan7383/sofatime-patches](https://github.com/alan7383/sofatime-patches) | [@alan7383](https://github.com/alan7383) |
| 9 | [Alastor-Kaneki/Morphe-Patches](https://github.com/Alastor-Kaneki/Morphe-Patches) | [@Alastor-Kaneki](https://github.com/Alastor-Kaneki) |
| 10 | [AlecBlance/android-patches](https://github.com/AlecBlance/android-patches) | [@AlecBlance](https://github.com/AlecBlance) |
| 11 | [alejandrobellver/pichiwa-patches](https://github.com/alejandrobellver/pichiwa-patches) | [@alejandrobellver](https://github.com/alejandrobellver) |
| 12 | [AlexNaga/android-patches](https://github.com/AlexNaga/android-patches) | [@AlexNaga](https://github.com/AlexNaga) |
| 13 | [Almewty/my-morphe-patches](https://github.com/Almewty/my-morphe-patches) | [@Almewty](https://github.com/Almewty) |
| 14 | [ameenalasady/ameen-morphe](https://github.com/ameenalasady/ameen-morphe) | [@ameenalasady](https://github.com/ameenalasady) |
| 15 | [ameenalasady/photogrid-morphe](https://github.com/ameenalasady/photogrid-morphe) | [@ameenalasady](https://github.com/ameenalasady) |
| 16 | [Amitaisela/travian-morphe-patches](https://github.com/Amitaisela/travian-morphe-patches) | [@Amitaisela](https://github.com/Amitaisela) |
| 17 | [AmpleReVanced/revanced-patches](https://github.com/AmpleReVanced/revanced-patches) | [@AmpleReVanced](https://github.com/AmpleReVanced) |
| 18 | [anddea/revanced-patches](https://github.com/anddea/revanced-patches) | [@anddea](https://github.com/anddea) |
| 19 | [andersonlucasg3/PetalMaps-AndroidAuto](https://github.com/andersonlucasg3/PetalMaps-AndroidAuto) | [@andersonlucasg3](https://github.com/andersonlucasg3) |
| 20 | [andersonlucasg3/PetalMaps-NonHuawei](https://github.com/andersonlucasg3/PetalMaps-NonHuawei) | [@andersonlucasg3](https://github.com/andersonlucasg3) |
| 21 | [andrewliang25/morphe-patches](https://github.com/andrewliang25/morphe-patches) | [@andrewliang25](https://github.com/andrewliang25) |
| 22 | [andronedev/morphe-patches](https://github.com/andronedev/morphe-patches) | [@andronedev](https://github.com/andronedev) |
| 23 | [andronedev/morphe-portal-patch](https://github.com/andronedev/morphe-portal-patch) | [@andronedev](https://github.com/andronedev) |
| 24 | [ang3lo-azevedo/morphe-patches](https://github.com/ang3lo-azevedo/morphe-patches) | [@ang3lo-azevedo](https://github.com/ang3lo-azevedo) |
| 25 | [AngelDark92/steamlink-patches](https://github.com/AngelDark92/steamlink-patches) | [@AngelDark92](https://github.com/AngelDark92) |
| 26 | [anxyis/anxy-patches](https://github.com/anxyis/anxy-patches) | [@anxyis](https://github.com/anxyis) |
| 27 | [Apostolique/apos-morphe-patches](https://github.com/Apostolique/apos-morphe-patches) | [@Apostolique](https://github.com/Apostolique) |
| 28 | [arandomhooman/hoomans-morphe-patches](https://github.com/arandomhooman/hoomans-morphe-patches) | [@arandomhooman](https://github.com/arandomhooman) |
| 29 | [archie9211/morphe-patches](https://github.com/archie9211/morphe-patches) | [@archie9211](https://github.com/archie9211) |
| 30 | [areteruhiro/Haiagaru-Morphe](https://github.com/areteruhiro/Haiagaru-Morphe) | [@areteruhiro](https://github.com/areteruhiro) |
| 31 | [ARHCOS/arhcos-patches](https://github.com/ARHCOS/arhcos-patches) | [@ARHCOS](https://github.com/ARHCOS) |
| 32 | [ariecos/gemini-patches](https://github.com/ariecos/gemini-patches) | [@ariecos](https://github.com/ariecos) |
| 33 | [arunpdl/morphe-patches](https://github.com/arunpdl/morphe-patches) | [@arunpdl](https://github.com/arunpdl) |
| 34 | [azksama/aniskip-stremio](https://github.com/azksama/aniskip-stremio) | [@azksama](https://github.com/azksama) |
| 35 | [AzukiSensei/aniskip-stremio](https://github.com/AzukiSensei/aniskip-stremio) | [@AzukiSensei](https://github.com/AzukiSensei) |
| 36 | [babyhuehnchen/morphe-patches](https://github.com/babyhuehnchen/morphe-patches) | [@babyhuehnchen](https://github.com/babyhuehnchen) |
| 37 | [bdgerszewski/morphe-patches-ihealth](https://github.com/bdgerszewski/morphe-patches-ihealth) | [@bdgerszewski](https://github.com/bdgerszewski) |
| 38 | [benzophury/oraimo-health-morphe-patches](https://github.com/benzophury/oraimo-health-morphe-patches) | [@benzophury](https://github.com/benzophury) |
| 39 | [bernardo7894/remove-permaban-banner-patch](https://github.com/bernardo7894/remove-permaban-banner-patch) | [@bernardo7894](https://github.com/bernardo7894) |
| 40 | [BholeyKaBhakt/android-patches-xtra](https://github.com/BholeyKaBhakt/android-patches-xtra) | [@BholeyKaBhakt](https://github.com/BholeyKaBhakt) |
| 41 | [bigyank/morphe-patches-samsung](https://github.com/bigyank/morphe-patches-samsung) | [@bigyank](https://github.com/bigyank) |
| 42 | [binarymend/morphe-patches](https://github.com/binarymend/morphe-patches) | [@binarymend](https://github.com/binarymend) |
| 43 | [BlazeFTL/FTL-Patches](https://github.com/BlazeFTL/FTL-Patches) | [@BlazeFTL](https://github.com/BlazeFTL) |
| 44 | [BlazeFTL/Morphe-Portal-Patches-New](https://github.com/BlazeFTL/Morphe-Portal-Patches-New) | [@BlazeFTL](https://github.com/BlazeFTL) |
| 45 | [BlueDragon4251/tiktok-patches-for-morphe](https://github.com/BlueDragon4251/tiktok-patches-for-morphe) | [@BlueDragon4251](https://github.com/BlueDragon4251) |
| 46 | [braiNtropy/braintropy-patches](https://github.com/braiNtropy/braintropy-patches) | [@braiNtropy](https://github.com/braiNtropy) |
| 47 | [brosssh/morphe-patches](https://github.com/brosssh/morphe-patches) | [@brosssh](https://github.com/brosssh) |
| 48 | [browzomje/browzomje-patches](https://github.com/browzomje/browzomje-patches) | [@browzomje](https://github.com/browzomje) |
| 49 | [bruddaa/bruddas-morphe-patches](https://github.com/bruddaa/bruddas-morphe-patches) | [@bruddaa](https://github.com/bruddaa) |
| 50 | [bufferk/morphe-patches](https://github.com/bufferk/morphe-patches) | [@bufferk](https://github.com/bufferk) |
| 51 | [Burhanverse/test](https://github.com/Burhanverse/test) | [@Burhanverse](https://github.com/Burhanverse) |
| 52 | [byehi98/okish-morphe-patches](https://github.com/byehi98/okish-morphe-patches) | [@byehi98](https://github.com/byehi98) |
| 53 | [canh0chua/Morphe-patches](https://github.com/canh0chua/Morphe-patches) | [@canh0chua](https://github.com/canh0chua) |
| 54 | [catsmoker/anime-witcher-patches](https://github.com/catsmoker/anime-witcher-patches) | [@catsmoker](https://github.com/catsmoker) |
| 55 | [cesbar/zpatches](https://github.com/cesbar/zpatches) | [@cesbar](https://github.com/cesbar) |
| 56 | [ch3thanhs/stylus](https://github.com/ch3thanhs/stylus) | [@ch3thanhs](https://github.com/ch3thanhs) |
| 57 | [chicco-carone/morphe-patches-chicco](https://github.com/chicco-carone/morphe-patches-chicco) | [@chicco-carone](https://github.com/chicco-carone) |
| 58 | [chirag127/morphe-patches](https://github.com/chirag127/morphe-patches) | [@chirag127](https://github.com/chirag127) |
| 59 | [chukfinley/tidal-patches](https://github.com/chukfinley/tidal-patches) | [@chukfinley](https://github.com/chukfinley) |
| 60 | [ciraolone/morphe-watch-later](https://github.com/ciraolone/morphe-watch-later) | [@ciraolone](https://github.com/ciraolone) |
| 61 | [claviola/morphe-patches-nl](https://github.com/claviola/morphe-patches-nl) | [@claviola](https://github.com/claviola) |
| 62 | [crimera/piko](https://github.com/crimera/piko) | [@crimera](https://github.com/crimera) |
| 63 | [crimera/piko-newx](https://github.com/crimera/piko-newx) | [@crimera](https://github.com/crimera) |
| 64 | [csagataj2/morphe-patches](https://github.com/csagataj2/morphe-patches) | [@csagataj2](https://github.com/csagataj2) |
| 65 | [d0nj/morphe-patches](https://github.com/d0nj/morphe-patches) | [@d0nj](https://github.com/d0nj) |
| 66 | [Dan1elTheMan1el/Morphe-Patches](https://github.com/Dan1elTheMan1el/Morphe-Patches) | [@Dan1elTheMan1el](https://github.com/Dan1elTheMan1el) |
| 67 | [DarioDKM/ringconn-patches](https://github.com/DarioDKM/ringconn-patches) | [@DarioDKM](https://github.com/DarioDKM) |
| 68 | [david419kr/niconico-yt-morphe-patches](https://github.com/david419kr/niconico-yt-morphe-patches) | [@david419kr](https://github.com/david419kr) |
| 69 | [debakarr/morphe-patches](https://github.com/debakarr/morphe-patches) | [@debakarr](https://github.com/debakarr) |
| 70 | [dexnis-dev/morphe-patches](https://github.com/dexnis-dev/morphe-patches) | [@dexnis-dev](https://github.com/dexnis-dev) |
| 71 | [dh6k/morphe-patches](https://github.com/dh6k/morphe-patches) | [@dh6k](https://github.com/dh6k) |
| 72 | [dhrubonai/morphe-patches](https://github.com/dhrubonai/morphe-patches) | [@dhrubonai](https://github.com/dhrubonai) |
| 73 | [docbt/patched-up](https://github.com/docbt/patched-up) | [@docbt](https://github.com/docbt) |
| 74 | [Dr4w/morphe-patches](https://github.com/Dr4w/morphe-patches) | [@Dr4w](https://github.com/Dr4w) |
| 75 | [drnhzn/supreme-patches](https://github.com/drnhzn/supreme-patches) | [@drnhzn](https://github.com/drnhzn) |
| 76 | [drosoCode/morphe-patches](https://github.com/drosoCode/morphe-patches) | [@drosoCode](https://github.com/drosoCode) |
| 77 | [dumb-software/T2C-App-Patch-Morphe](https://github.com/dumb-software/T2C-App-Patch-Morphe) | [@dumb-software](https://github.com/dumb-software) |
| 78 | [dumketo/multi-app-patches](https://github.com/dumketo/multi-app-patches) | [@dumketo](https://github.com/dumketo) |
| 79 | [durgesh0505/chiggi_morphe_patches](https://github.com/durgesh0505/chiggi_morphe_patches) | [@durgesh0505](https://github.com/durgesh0505) |
| 80 | [Educal72/educal-patches](https://github.com/Educal72/educal-patches) | [@Educal72](https://github.com/Educal72) |
| 81 | [electiveDev/tiaruebar-patches-vip-fix](https://github.com/electiveDev/tiaruebar-patches-vip-fix) | [@electiveDev](https://github.com/electiveDev) |
| 82 | [enccmp/mn-patches](https://github.com/enccmp/mn-patches) | [@enccmp](https://github.com/enccmp) |
| 83 | [Entree3k/Morning-Entree-Patches](https://github.com/Entree3k/Morning-Entree-Patches) | [@Entree3k](https://github.com/Entree3k) |
| 84 | [Epxec/android-patches](https://github.com/Epxec/android-patches) | [@Epxec](https://github.com/Epxec) |
| 85 | [ethanm6/letterboxd-stremio-morphe-patch](https://github.com/ethanm6/letterboxd-stremio-morphe-patch) | [@ethanm6](https://github.com/ethanm6) |
| 86 | [eyalm2000/tidal-debug-menu](https://github.com/eyalm2000/tidal-debug-menu) | [@eyalm2000](https://github.com/eyalm2000) |
| 87 | [eZ4RK0/morphe-patches](https://github.com/eZ4RK0/morphe-patches) | [@eZ4RK0](https://github.com/eZ4RK0) |
| 88 | [fangkampanat/gmaps-patches](https://github.com/fangkampanat/gmaps-patches) | [@fangkampanat](https://github.com/fangkampanat) |
| 89 | [FoxxoOwO/foxxo-patches](https://github.com/FoxxoOwO/foxxo-patches) | [@FoxxoOwO](https://github.com/FoxxoOwO) |
| 90 | [franticg33k/morphe-patches](https://github.com/franticg33k/morphe-patches) | [@franticg33k](https://github.com/franticg33k) |
| 91 | [Freeman022026/rustore-privacy-patches](https://github.com/Freeman022026/rustore-privacy-patches) | [@Freeman022026](https://github.com/Freeman022026) |
| 92 | [Fripe070/PixivPatches](https://github.com/Fripe070/PixivPatches) | [@Fripe070](https://github.com/Fripe070) |
| 93 | [furkngld/tiktok-lite-patches-for-morphe](https://github.com/furkngld/tiktok-lite-patches-for-morphe) | [@furkngld](https://github.com/furkngld) |
| 94 | [gitlab.com/early.egg3707](https://github.com/gitlab.com/early.egg3707) | [@gitlab.com](https://github.com/gitlab.com) |
| 95 | [gitlab.com/IMXEren](https://github.com/gitlab.com/IMXEren) | [@gitlab.com](https://github.com/gitlab.com) |
| 96 | [gitlab.com/inotia00](https://github.com/gitlab.com/inotia00) | [@gitlab.com](https://github.com/gitlab.com) |
| 97 | [gitlab.com/inotia00](https://github.com/gitlab.com/inotia00) | [@gitlab.com](https://github.com/gitlab.com) |
| 98 | [gitlab.com/Paresh-Maheshwari](https://github.com/gitlab.com/Paresh-Maheshwari) | [@gitlab.com](https://github.com/gitlab.com) |
| 99 | [GoldRift/morphe-patches](https://github.com/GoldRift/morphe-patches) | [@GoldRift](https://github.com/GoldRift) |
| 100 | [Graywizard888/Enhancify](https://github.com/Graywizard888/Enhancify) | [@Graywizard888](https://github.com/Graywizard888) |
| 101 | [hackingguy/morphe-patches](https://github.com/hackingguy/morphe-patches) | [@hackingguy](https://github.com/hackingguy) |
| 102 | [Hari-sys786/telegram-patches](https://github.com/Hari-sys786/telegram-patches) | [@Hari-sys786](https://github.com/Hari-sys786) |
| 103 | [hashtagbasit/aimal-patches](https://github.com/hashtagbasit/aimal-patches) | [@hashtagbasit](https://github.com/hashtagbasit) |
| 104 | [heinrich26/morphe-patches](https://github.com/heinrich26/morphe-patches) | [@heinrich26](https://github.com/heinrich26) |
| 105 | [HelioFloxZ/HelioFloxZ-Patches](https://github.com/HelioFloxZ/HelioFloxZ-Patches) | [@HelioFloxZ](https://github.com/HelioFloxZ) |
| 106 | [HelioFloxZ/YouTube-Studio-Patches](https://github.com/HelioFloxZ/YouTube-Studio-Patches) | [@HelioFloxZ](https://github.com/HelioFloxZ) |
| 107 | [HellveticaStandard/HellveticaPatches](https://github.com/HellveticaStandard/HellveticaPatches) | [@HellveticaStandard](https://github.com/HellveticaStandard) |
| 108 | [heval99/Heval-Morphe-Patches](https://github.com/heval99/Heval-Morphe-Patches) | [@heval99](https://github.com/heval99) |
| 109 | [heval99/morphe-patches](https://github.com/heval99/morphe-patches) | [@heval99](https://github.com/heval99) |
| 110 | [hhawkinsau/hh-patches](https://github.com/hhawkinsau/hh-patches) | [@hhawkinsau](https://github.com/hhawkinsau) |
| 111 | [Hiosdra/morphe-patches](https://github.com/Hiosdra/morphe-patches) | [@Hiosdra](https://github.com/Hiosdra) |
| 112 | [homelander11/beetle-patches](https://github.com/homelander11/beetle-patches) | [@homelander11](https://github.com/homelander11) |
| 113 | [hoo-dles/jadx-morphe](https://github.com/hoo-dles/jadx-morphe) | [@hoo-dles](https://github.com/hoo-dles) |
| 114 | [hoo-dles/morphe-patches](https://github.com/hoo-dles/morphe-patches) | [@hoo-dles](https://github.com/hoo-dles) |
| 115 | [HSlightsteel/slight-patches](https://github.com/HSlightsteel/slight-patches) | [@HSlightsteel](https://github.com/HSlightsteel) |
| 116 | [hu-liberator/patches](https://github.com/hu-liberator/patches) | [@hu-liberator](https://github.com/hu-liberator) |
| 117 | [humzakh/HK-Morphe-Patches](https://github.com/humzakh/HK-Morphe-Patches) | [@humzakh](https://github.com/humzakh) |
| 118 | [HvQ/eksi-morphe](https://github.com/HvQ/eksi-morphe) | [@HvQ](https://github.com/HvQ) |
| 119 | [hxreborn/hxreborn-tiktok-patches](https://github.com/hxreborn/hxreborn-tiktok-patches) | [@hxreborn](https://github.com/hxreborn) |
| 120 | [hxreborn/morphe-patches](https://github.com/hxreborn/morphe-patches) | [@hxreborn](https://github.com/hxreborn) |
| 121 | [icysymmetra/tiktok-patches-for-morphe](https://github.com/icysymmetra/tiktok-patches-for-morphe) | [@icysymmetra](https://github.com/icysymmetra) |
| 122 | [Ikuradachi/ikura-patches](https://github.com/Ikuradachi/ikura-patches) | [@Ikuradachi](https://github.com/Ikuradachi) |
| 123 | [ilikeadofai/vocacolle-morphe-patches](https://github.com/ilikeadofai/vocacolle-morphe-patches) | [@ilikeadofai](https://github.com/ilikeadofai) |
| 124 | [ImmortalZeus/ImmortalZeus-Morphe-Patches](https://github.com/ImmortalZeus/ImmortalZeus-Morphe-Patches) | [@ImmortalZeus](https://github.com/ImmortalZeus) |
| 125 | [ImNoammm/morphe-spotify-patches](https://github.com/ImNoammm/morphe-spotify-patches) | [@ImNoammm](https://github.com/ImNoammm) |
| 126 | [IMXEren/mix-patches](https://github.com/IMXEren/mix-patches) | [@IMXEren](https://github.com/IMXEren) |
| 127 | [Insane96/Pinterest-patch](https://github.com/Insane96/Pinterest-patch) | [@Insane96](https://github.com/Insane96) |
| 128 | [ispacecase/patchweaver](https://github.com/ispacecase/patchweaver) | [@ispacecase](https://github.com/ispacecase) |
| 129 | [isuruhg/cricinfo-tweaks](https://github.com/isuruhg/cricinfo-tweaks) | [@isuruhg](https://github.com/isuruhg) |
| 130 | [isuruhg/fin-tweaks](https://github.com/isuruhg/fin-tweaks) | [@isuruhg](https://github.com/isuruhg) |
| 131 | [itsthejoker/itsthejoker-patches](https://github.com/itsthejoker/itsthejoker-patches) | [@itsthejoker](https://github.com/itsthejoker) |
| 132 | [jackblk/morphe-patches](https://github.com/jackblk/morphe-patches) | [@jackblk](https://github.com/jackblk) |
| 133 | [JacobPlaysGames/CrimeRadar-Morphe-Patches](https://github.com/JacobPlaysGames/CrimeRadar-Morphe-Patches) | [@JacobPlaysGames](https://github.com/JacobPlaysGames) |
| 134 | [jancerny2001/morphe-patches](https://github.com/jancerny2001/morphe-patches) | [@jancerny2001](https://github.com/jancerny2001) |
| 135 | [jaredcat/morphe-patches](https://github.com/jaredcat/morphe-patches) | [@jaredcat](https://github.com/jaredcat) |
| 136 | [jasonwu1994/Gboard-patches](https://github.com/jasonwu1994/Gboard-patches) | [@jasonwu1994](https://github.com/jasonwu1994) |
| 137 | [jkennethcarino/adobo](https://github.com/jkennethcarino/adobo) | [@jkennethcarino](https://github.com/jkennethcarino) |
| 138 | [Jl4cTuk/morphe-patches](https://github.com/Jl4cTuk/morphe-patches) | [@Jl4cTuk](https://github.com/Jl4cTuk) |
| 139 | [Jman-Github/Awesome-ReVanced](https://github.com/Jman-Github/Awesome-ReVanced) | [@Jman-Github](https://github.com/Jman-Github) |
| 140 | [Jman-Github/ReVanced-Patch-Bundles](https://github.com/Jman-Github/ReVanced-Patch-Bundles) | [@Jman-Github](https://github.com/Jman-Github) |
| 141 | [Jman-Github/Universal-ReVanced-Manager](https://github.com/Jman-Github/Universal-ReVanced-Manager) | [@Jman-Github](https://github.com/Jman-Github) |
| 142 | [Joristdh/Platypatch](https://github.com/Joristdh/Platypatch) | [@Joristdh](https://github.com/Joristdh) |
| 143 | [Joussflls10/Jouss-Patches](https://github.com/Joussflls10/Jouss-Patches) | [@Joussflls10](https://github.com/Joussflls10) |
| 144 | [jrddupont/discord-patches](https://github.com/jrddupont/discord-patches) | [@jrddupont](https://github.com/jrddupont) |
| 145 | [JZ6/Flexboard](https://github.com/JZ6/Flexboard) | [@JZ6](https://github.com/JZ6) |
| 146 | [kanup4m/morphe-patches](https://github.com/kanup4m/morphe-patches) | [@kanup4m](https://github.com/kanup4m) |
| 147 | [kareemlukitomo/morphe-patches](https://github.com/kareemlukitomo/morphe-patches) | [@kareemlukitomo](https://github.com/kareemlukitomo) |
| 148 | [Kecerim24/morphe-patches](https://github.com/Kecerim24/morphe-patches) | [@Kecerim24](https://github.com/Kecerim24) |
| 149 | [kiraio-moe/Lain-Patches](https://github.com/kiraio-moe/Lain-Patches) | [@kiraio-moe](https://github.com/kiraio-moe) |
| 150 | [kolaron/morphe-patches](https://github.com/kolaron/morphe-patches) | [@kolaron](https://github.com/kolaron) |
| 151 | [kondratjev/morphe-patches](https://github.com/kondratjev/morphe-patches) | [@kondratjev](https://github.com/kondratjev) |
| 152 | [kontsevoye/emorphe-patches](https://github.com/kontsevoye/emorphe-patches) | [@kontsevoye](https://github.com/kontsevoye) |
| 153 | [kuchingneko28/ipusnas-patches](https://github.com/kuchingneko28/ipusnas-patches) | [@kuchingneko28](https://github.com/kuchingneko28) |
| 154 | [kun-codes/npci-bhim-morphe-patches](https://github.com/kun-codes/npci-bhim-morphe-patches) | [@kun-codes](https://github.com/kun-codes) |
| 155 | [kuntal-devrat/diskwala-patches](https://github.com/kuntal-devrat/diskwala-patches) | [@kuntal-devrat](https://github.com/kuntal-devrat) |
| 156 | [kveld9/kveld-morphe-patches](https://github.com/kveld9/kveld-morphe-patches) | [@kveld9](https://github.com/kveld9) |
| 157 | [LaBlazer/morphe-patches](https://github.com/LaBlazer/morphe-patches) | [@LaBlazer](https://github.com/LaBlazer) |
| 158 | [LaKakaReal/LaKakaShitPatches](https://github.com/LaKakaReal/LaKakaShitPatches) | [@LaKakaReal](https://github.com/LaKakaReal) |
| 159 | [legendsciber/morphe-patches](https://github.com/legendsciber/morphe-patches) | [@legendsciber](https://github.com/legendsciber) |
| 160 | [liongalahad/liongalahad-nuviotv-morphe-patches](https://github.com/liongalahad/liongalahad-nuviotv-morphe-patches) | [@liongalahad](https://github.com/liongalahad) |
| 161 | [liongalahad/liongalahad-stremio-morphe-patches](https://github.com/liongalahad/liongalahad-stremio-morphe-patches) | [@liongalahad](https://github.com/liongalahad) |
| 162 | [liongalahad/nuviotv-morphe-patches](https://github.com/liongalahad/nuviotv-morphe-patches) | [@liongalahad](https://github.com/liongalahad) |
| 163 | [liongalahad/nuviotv-patches](https://github.com/liongalahad/nuviotv-patches) | [@liongalahad](https://github.com/liongalahad) |
| 164 | [liongalahad/stremio-androidTV-morphe-patches](https://github.com/liongalahad/stremio-androidTV-morphe-patches) | [@liongalahad](https://github.com/liongalahad) |
| 165 | [LOCKhart07/morphe-patches](https://github.com/LOCKhart07/morphe-patches) | [@LOCKhart07](https://github.com/LOCKhart07) |
| 166 | [logm1lo/logm1lo-patches](https://github.com/logm1lo/logm1lo-patches) | [@logm1lo](https://github.com/logm1lo) |
| 167 | [lootdev78/psylos-morphe-patches](https://github.com/lootdev78/psylos-morphe-patches) | [@lootdev78](https://github.com/lootdev78) |
| 168 | [loskutov/youtube-domain-fronting-patch](https://github.com/loskutov/youtube-domain-fronting-patch) | [@loskutov](https://github.com/loskutov) |
| 169 | [Lynx6319/patch-youtube-scroll-block](https://github.com/Lynx6319/patch-youtube-scroll-block) | [@Lynx6319](https://github.com/Lynx6319) |
| 170 | [lyyako/realme-link-patches](https://github.com/lyyako/realme-link-patches) | [@lyyako](https://github.com/lyyako) |
| 171 | [madhu-gowda6/atharv-patches](https://github.com/madhu-gowda6/atharv-patches) | [@madhu-gowda6](https://github.com/madhu-gowda6) |
| 172 | [MarcaDian/morphe-patches-yavot](https://github.com/MarcaDian/morphe-patches-yavot) | [@MarcaDian](https://github.com/MarcaDian) |
| 173 | [MauroGamerVN/Morphe-Patches](https://github.com/MauroGamerVN/Morphe-Patches) | [@MauroGamerVN](https://github.com/MauroGamerVN) |
| 174 | [meridianfresco/morphe-meta-patches](https://github.com/meridianfresco/morphe-meta-patches) | [@meridianfresco](https://github.com/meridianfresco) |
| 175 | [MiguelNinja19/miguel-morphe-patches](https://github.com/MiguelNinja19/miguel-morphe-patches) | [@MiguelNinja19](https://github.com/MiguelNinja19) |
| 176 | [miketweaver/friendsturner-patches](https://github.com/miketweaver/friendsturner-patches) | [@miketweaver](https://github.com/miketweaver) |
| 177 | [MohamedElnaggar00/morphe-patches-tiktok-lite-only](https://github.com/MohamedElnaggar00/morphe-patches-tiktok-lite-only) | [@MohamedElnaggar00](https://github.com/MohamedElnaggar00) |
| 178 | [MoonShadowKeeper/Telegram-patchesMorphe](https://github.com/MoonShadowKeeper/Telegram-patchesMorphe) | [@MoonShadowKeeper](https://github.com/MoonShadowKeeper) |
| 179 | [MorpheApp/morphe-patches](https://github.com/MorpheApp/morphe-patches) | [@MorpheApp](https://github.com/MorpheApp) |
| 180 | [mvaishak/letterboxd-morphe-patches](https://github.com/mvaishak/letterboxd-morphe-patches) | [@mvaishak](https://github.com/mvaishak) |
| 181 | [mxkrgt/dbtcoach-morphe-patches](https://github.com/mxkrgt/dbtcoach-morphe-patches) | [@mxkrgt](https://github.com/mxkrgt) |
| 182 | [Nagol12344/patch](https://github.com/Nagol12344/patch) | [@Nagol12344](https://github.com/Nagol12344) |
| 183 | [Nai64/Nai64Patches](https://github.com/Nai64/Nai64Patches) | [@Nai64](https://github.com/Nai64) |
| 184 | [NekoGryphou/gryphous-morphe-patches](https://github.com/NekoGryphou/gryphous-morphe-patches) | [@NekoGryphou](https://github.com/NekoGryphou) |
| 185 | [Nerahikada/asken-patches](https://github.com/Nerahikada/asken-patches) | [@Nerahikada](https://github.com/Nerahikada) |
| 186 | [nosini/disable-shorts-repeat](https://github.com/nosini/disable-shorts-repeat) | [@nosini](https://github.com/nosini) |
| 187 | [NullWaypoint/morphe-patches](https://github.com/NullWaypoint/morphe-patches) | [@NullWaypoint](https://github.com/NullWaypoint) |
| 188 | [nvbangg/builder-for-morphe](https://github.com/nvbangg/builder-for-morphe) | [@nvbangg](https://github.com/nvbangg) |
| 189 | [Okazakee/iptv-morphe-patches](https://github.com/Okazakee/iptv-morphe-patches) | [@Okazakee](https://github.com/Okazakee) |
| 190 | [osirisad/teamsnap-patches](https://github.com/osirisad/teamsnap-patches) | [@osirisad](https://github.com/osirisad) |
| 191 | [osirisad/ts-patches](https://github.com/osirisad/ts-patches) | [@osirisad](https://github.com/osirisad) |
| 192 | [ozeroztas/Morphe-Patch](https://github.com/ozeroztas/Morphe-Patch) | [@ozeroztas](https://github.com/ozeroztas) |
| 193 | [Pa-kon/morphe-screenshot-patches](https://github.com/Pa-kon/morphe-screenshot-patches) | [@Pa-kon](https://github.com/Pa-kon) |
| 194 | [Paresh-Maheshwari/patch-explorer](https://github.com/Paresh-Maheshwari/patch-explorer) | [@Paresh-Maheshwari](https://github.com/Paresh-Maheshwari) |
| 195 | [PawiX25/pepper-morphe-patches](https://github.com/PawiX25/pepper-morphe-patches) | [@PawiX25](https://github.com/PawiX25) |
| 196 | [picarica/My-moprhe-patches](https://github.com/picarica/My-moprhe-patches) | [@picarica](https://github.com/picarica) |
| 197 | [PixelPusher247/morphe-patches](https://github.com/PixelPusher247/morphe-patches) | [@PixelPusher247](https://github.com/PixelPusher247) |
| 198 | [pmaxhogan/vantage-patches](https://github.com/pmaxhogan/vantage-patches) | [@pmaxhogan](https://github.com/pmaxhogan) |
| 199 | [polka-bear/morphe-patches](https://github.com/polka-bear/morphe-patches) | [@polka-bear](https://github.com/polka-bear) |
| 200 | [PrathxmOp/Prathxm-Patches](https://github.com/PrathxmOp/Prathxm-Patches) | [@PrathxmOp](https://github.com/PrathxmOp) |
| 201 | [PrathxmOp/ytmusic-patches](https://github.com/PrathxmOp/ytmusic-patches) | [@PrathxmOp](https://github.com/PrathxmOp) |
| 202 | [pseudofractal/morphe-patches](https://github.com/pseudofractal/morphe-patches) | [@pseudofractal](https://github.com/pseudofractal) |
| 203 | [PyFlat-JR/Morphe-Patches](https://github.com/PyFlat-JR/Morphe-Patches) | [@PyFlat-JR](https://github.com/PyFlat-JR) |
| 204 | [quantavil/edge-morphe-patches](https://github.com/quantavil/edge-morphe-patches) | [@quantavil](https://github.com/quantavil) |
| 205 | [Quantro100/Morphe-patches](https://github.com/Quantro100/Morphe-patches) | [@Quantro100](https://github.com/Quantro100) |
| 206 | [RabehX/rabehx-patches](https://github.com/RabehX/rabehx-patches) | [@RabehX](https://github.com/RabehX) |
| 207 | [rafag00/morphe-patches](https://github.com/rafag00/morphe-patches) | [@rafag00](https://github.com/rafag00) |
| 208 | [rahul9999xda/telegram-morphe-patches](https://github.com/rahul9999xda/telegram-morphe-patches) | [@rahul9999xda](https://github.com/rahul9999xda) |
| 209 | [RealCyberwash/max-patches](https://github.com/RealCyberwash/max-patches) | [@RealCyberwash](https://github.com/RealCyberwash) |
| 210 | [rhubarbshoelaces/morphe-patches](https://github.com/rhubarbshoelaces/morphe-patches) | [@rhubarbshoelaces](https://github.com/rhubarbshoelaces) |
| 211 | [riky-dev/morphe-patches](https://github.com/riky-dev/morphe-patches) | [@riky-dev](https://github.com/riky-dev) |
| 212 | [Ripthulhu/morphe-google-patches](https://github.com/Ripthulhu/morphe-google-patches) | [@Ripthulhu](https://github.com/Ripthulhu) |
| 213 | [RookieEnough/De-Vanced](https://github.com/RookieEnough/De-Vanced) | [@RookieEnough](https://github.com/RookieEnough) |
| 214 | [RoundSalmon4/morphe-patches-template](https://github.com/RoundSalmon4/morphe-patches-template) | [@RoundSalmon4](https://github.com/RoundSalmon4) |
| 215 | [rushiranpise/RI-Vanced-Universal-Morphe-Patches](https://github.com/rushiranpise/RI-Vanced-Universal-Morphe-Patches) | [@rushiranpise](https://github.com/rushiranpise) |
| 216 | [rushiranpise/Ri-Vanced-Universal-Morphe-Patches](https://github.com/rushiranpise/Ri-Vanced-Universal-Morphe-Patches) | [@rushiranpise](https://github.com/rushiranpise) |
| 217 | [ryuya0124/gemini-microg-patches](https://github.com/ryuya0124/gemini-microg-patches) | [@ryuya0124](https://github.com/ryuya0124) |
| 218 | [saieshshirodkar/saiesh-morphe-patches](https://github.com/saieshshirodkar/saiesh-morphe-patches) | [@saieshshirodkar](https://github.com/saieshshirodkar) |
| 219 | [Santodan/santodan-patches](https://github.com/Santodan/santodan-patches) | [@Santodan](https://github.com/Santodan) |
| 220 | [SapitoSucio/FroggoMorphePatches](https://github.com/SapitoSucio/FroggoMorphePatches) | [@SapitoSucio](https://github.com/SapitoSucio) |
| 221 | [sashade8-ship-it/dual-vot-patches](https://github.com/sashade8-ship-it/dual-vot-patches) | [@sashade8-ship-it](https://github.com/sashade8-ship-it) |
| 222 | [Seobject/Seobject-patches](https://github.com/Seobject/Seobject-patches) | [@Seobject](https://github.com/Seobject) |
| 223 | [Sfehhrths/ekispert-morphe-patches](https://github.com/Sfehhrths/ekispert-morphe-patches) | [@Sfehhrths](https://github.com/Sfehhrths) |
| 224 | [shaun-the-sheep-patches/morphe-patches](https://github.com/shaun-the-sheep-patches/morphe-patches) | [@shaun-the-sheep-patches](https://github.com/shaun-the-sheep-patches) |
| 225 | [ShuhaibNC/morphe-patches](https://github.com/ShuhaibNC/morphe-patches) | [@ShuhaibNC](https://github.com/ShuhaibNC) |
| 226 | [sjshb57/Pairip-Patches](https://github.com/sjshb57/Pairip-Patches) | [@sjshb57](https://github.com/sjshb57) |
| 227 | [skulldogged/cobalt-morphe](https://github.com/skulldogged/cobalt-morphe) | [@skulldogged](https://github.com/skulldogged) |
| 228 | [SouBryan/pinterest-morphed](https://github.com/SouBryan/pinterest-morphed) | [@SouBryan](https://github.com/SouBryan) |
| 229 | [spookyexe/morphe-patches](https://github.com/spookyexe/morphe-patches) | [@spookyexe](https://github.com/spookyexe) |
| 230 | [subenoeva/roadsync-patches](https://github.com/subenoeva/roadsync-patches) | [@subenoeva](https://github.com/subenoeva) |
| 231 | [sushruth/imgur-patches](https://github.com/sushruth/imgur-patches) | [@sushruth](https://github.com/sushruth) |
| 232 | [SysAdminDoc/hushfeed](https://github.com/SysAdminDoc/hushfeed) | [@SysAdminDoc](https://github.com/SysAdminDoc) |
| 233 | [tadikwa/google-clock-morphe-patches](https://github.com/tadikwa/google-clock-morphe-patches) | [@tadikwa](https://github.com/tadikwa) |
| 234 | [theabhishekbhujang/morphe-patches](https://github.com/theabhishekbhujang/morphe-patches) | [@theabhishekbhujang](https://github.com/theabhishekbhujang) |
| 235 | [thejaustin/smartlauncher-morphe-patches](https://github.com/thejaustin/smartlauncher-morphe-patches) | [@thejaustin](https://github.com/thejaustin) |
| 236 | [TheRealCrazyfuy/abeja-morphe-patches](https://github.com/TheRealCrazyfuy/abeja-morphe-patches) | [@TheRealCrazyfuy](https://github.com/TheRealCrazyfuy) |
| 237 | [TheRealSkywarp/morphe-patches](https://github.com/TheRealSkywarp/morphe-patches) | [@TheRealSkywarp](https://github.com/TheRealSkywarp) |
| 238 | [thrkingunknown/gboard-theme-patch](https://github.com/thrkingunknown/gboard-theme-patch) | [@thrkingunknown](https://github.com/thrkingunknown) |
| 239 | [tiaruebar1024/tiaruebar-patches](https://github.com/tiaruebar1024/tiaruebar-patches) | [@tiaruebar1024](https://github.com/tiaruebar1024) |
| 240 | [timpra/a17](https://github.com/timpra/a17) | [@timpra](https://github.com/timpra) |
| 241 | [Tornillo2/movistar-block-ads-morphe](https://github.com/Tornillo2/movistar-block-ads-morphe) | [@Tornillo2](https://github.com/Tornillo2) |
| 242 | [totsiaw/proxma-patches](https://github.com/totsiaw/proxma-patches) | [@totsiaw](https://github.com/totsiaw) |
| 243 | [Trimpsuz/morphe-busuu](https://github.com/Trimpsuz/morphe-busuu) | [@Trimpsuz](https://github.com/Trimpsuz) |
| 244 | [Utsavrajputt/Modx-patches](https://github.com/Utsavrajputt/Modx-patches) | [@Utsavrajputt](https://github.com/Utsavrajputt) |
| 245 | [V4n1X/morphe-patches](https://github.com/V4n1X/morphe-patches) | [@V4n1X](https://github.com/V4n1X) |
| 246 | [variablenine/morphe-patches](https://github.com/variablenine/morphe-patches) | [@variablenine](https://github.com/variablenine) |
| 247 | [vladon/morphe-patches-navi](https://github.com/vladon/morphe-patches-navi) | [@vladon](https://github.com/vladon) |
| 248 | [vomw/morphe-patches](https://github.com/vomw/morphe-patches) | [@vomw](https://github.com/vomw) |
| 249 | [WalkTheEarth/morphe-ytvr-patches](https://github.com/WalkTheEarth/morphe-ytvr-patches) | [@WalkTheEarth](https://github.com/WalkTheEarth) |
| 250 | [wchill/anddea-rvx-morphed](https://github.com/wchill/anddea-rvx-morphed) | [@wchill](https://github.com/wchill) |
| 251 | [wchill/patcheddit](https://github.com/wchill/patcheddit) | [@wchill](https://github.com/wchill) |
| 252 | [wchill/rvx-morphed](https://github.com/wchill/rvx-morphed) | [@wchill](https://github.com/wchill) |
| 253 | [WZSE/aapam-patches](https://github.com/WZSE/aapam-patches) | [@WZSE](https://github.com/WZSE) |
| 254 | [WZSE/morphe-patches](https://github.com/WZSE/morphe-patches) | [@WZSE](https://github.com/WZSE) |
| 255 | [Xhehab/Xhehab-Patches](https://github.com/Xhehab/Xhehab-Patches) | [@Xhehab](https://github.com/Xhehab) |
| 256 | [Xisrr1/Revancify-Xisr](https://github.com/Xisrr1/Revancify-Xisr) | [@Xisrr1](https://github.com/Xisrr1) |
| 257 | [xob0t/morphe-patches](https://github.com/xob0t/morphe-patches) | [@xob0t](https://github.com/xob0t) |
| 258 | [XTapped/morphe-patches](https://github.com/XTapped/morphe-patches) | [@XTapped](https://github.com/XTapped) |
| 259 | [yann-soliman/morphe-patches](https://github.com/yann-soliman/morphe-patches) | [@yann-soliman](https://github.com/yann-soliman) |
| 260 | [ynotzort/morphe-patches](https://github.com/ynotzort/morphe-patches) | [@ynotzort](https://github.com/ynotzort) |
| 261 | [Z-drgon/morphe-patches](https://github.com/Z-drgon/morphe-patches) | [@Z-drgon](https://github.com/Z-drgon) |
| 262 | [Zanuaimi/UniPatches](https://github.com/Zanuaimi/UniPatches) | [@Zanuaimi](https://github.com/Zanuaimi) |
| 263 | [zeldrisho/morphe-patches](https://github.com/zeldrisho/morphe-patches) | [@zeldrisho](https://github.com/zeldrisho) |

Missing or new? Check [`data/repos_list.txt`](data/repos_list.txt) for the most current list.

</details>

### Core Contributors

<table>
<tr>
  <td align="center">
    <a href="https://github.com/nvbangg">
      <img src="https://github.com/nvbangg.png" width="60" style="border-radius:50%"><br>
      <sub><b>@nvbangg</b></sub>
    </a>
    <br>
    <sub>awesome-for-morphe</sub>
  </td>
  <td align="center">
    <a href="https://github.com/rushiforai">
      <img src="https://github.com/rushiforai.png" width="60" style="border-radius:50%"><br>
      <sub><b>@rushiforai</b></sub>
    </a>
    <br>
    <sub>morphe-archive</sub>
  </td>
  <td align="center">
    <a href="https://github.com/Jman-Github">
      <img src="https://github.com/Jman-Github.png" width="60" style="border-radius:50%"><br>
      <sub><b>@Jman-Github</b></sub>
    </a>
    <br>
    <sub>ReVanced-Patch-Bundles</sub>
  </td>
</tr>
</table>

---

## Star History

<p align="center">
  <a href="https://www.star-history.com/?type=date&repos=drnx64%2Fmorphe-track-patches">
    <img src="https://api.star-history.com/svg?repos=drnx64/morphe-track-patches&type=Date&theme=dark" alt="Star History Chart" width="600">
  </a>
</p>

<p align="center">
  <sub><i>Star history chart powered by <a href="https://github.com/star-history/star-history">star-history</a></i></sub>
</p>

---

<p align="center">
  <sub>Built with ❤️ for the Morphe community</sub>
</p>

<p align="center">
  <a href="https://morphe-patches-drnx64.vercel.app/">
    <img src="https://img.shields.io/badge/Visit_Live_Dashboard-6366f1?style=for-the-badge&logo=vercel&logoColor=white" alt="Visit Dashboard">
  </a>
</p>
