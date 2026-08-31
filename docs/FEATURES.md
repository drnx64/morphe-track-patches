# MorpheTracker

**Track every Morphe patch, across every bundle, in real time.**

808 apps. 184 bundles. 181 repositories. Updated every 3 hours.

MorpheTracker is the central hub for the Morphe patch ecosystem — it automatically discovers, tracks, and compares community patch bundles so you never miss an update.

---

## Why MorpheTracker Exists

The Morphe patch ecosystem is massive and fragmented. Community developers maintain **180+ repositories** on GitHub and GitLab, each publishing their own `.mpp` patch bundles for different apps. There's no central place to see what's out there.

If you're using Morphe, you know the pain: you've added a few sources to your manager, but you have no idea what else exists. A new bundle drops support for an app you rely on — you find out weeks later. Someone publishes patches for an app you didn't even know was patchable — you never hear about it.

**MorpheTracker solves this.** It crawls the entire ecosystem on a schedule, fingerprints every bundle for changes, and presents everything in one real-time dashboard. Browse 808 apps, compare bundles side-by-side, and add sources to your Morphe manager with a single click.

---

## What It Does

- **Auto-discovers** patch bundles from GitHub and GitLab — no manual tracking required
- **Detects changes at the patch level** — not just "bundle updated," but exactly which patches were added, removed, or modified per app
- **One-click integration** — add any bundle as a source directly into your Morphe manager

---

## Features

### Dashboard & Discovery

**Today's Updates** — The first thing you see. Every scan (8x daily) surfaces new bundles, updated apps, removed apps, and version bumps. Three view modes:

- **Timeline** — chronological feed of changes with badge indicators
- **Accordion** — expandable sections grouped by bundle
- **Card Grid** — visual overview with app icons and patch counts

**Stats at a Glance** — Total bundles, total apps, new apps today, new bundles today. Know the ecosystem size instantly.

**Scan Countdown** — Real-time countdown to the next scan, current UTC time, scan batch progress (e.g., "Scan 3 of 8"). You always know when fresh data is coming.

**App Cards** — Each app shows its icon (fetched from Google Play), name, package name, how many bundles patch it, and an "Add to Morphe" button. Cards load progressively via infinite scroll.

---

### Deep Patch Intelligence

**Patch-Level Diffs** — When a bundle updates, MorpheTracker doesn't just tell you "something changed." It shows you:

- Patches **added** (new capabilities)
- Patches **removed** (lost functionality)
- Patches **modified** (description, options, or compatible versions changed)
- **Major Updates** flagged when 5+ patches change at once

**Version Compatibility** — See exactly which app versions each patch supports. Version chips show compatibility at a glance across stable and dev channels.

**Stable vs Dev Channels** — Every bundle is tracked on both stable and dev channels independently. Toggle between them to see what's production-ready vs what's in testing.

**Release Notes** — Parsed and rendered from GitHub/GitLab releases. Structured commit parsing handles conventional commits, scoped changes, and markdown formatting.

---

### Bundle Diff Tool

Compare any app across **all** bundles that patch it. Side-by-side view shows:

- Per-bundle cards with version, release date, and patch list
- **Color-coded patch overlap** — patches that exist in all bundles, some bundles, or are unique to one
- Legend explaining the color coding
- Share links for sending comparisons to others

This is the fastest way to decide which bundle to use for a specific app.

---

### One-Click Morphe Integration

**Add to Morphe** — Every app card and detail modal has a button that deep-links into your Morphe manager (`morphe.software/add-source?github=...`). No copy-pasting repo URLs.

**Bundle Chooser** — When an app is patched by multiple bundles, a modal lets you pick which source to add. See bundle version, channel, and app count before choosing.

---

### Watchlist & Notifications

**Watch Apps** — Mark any app as "watched" from its detail modal. Your watchlist persists in localStorage.

**Browser Notifications** — When a watched app is updated in any tracked bundle, MorpheTracker sends a native browser notification. Never miss a patch update for the apps you care about.

---

### Changelog & History

**Daily Changelog** — Historical record of every day's changes, with pagination. Each entry shows affected bundles, apps, and badge types.

**Bundle History** — Drill into any single bundle to see its full release history, parsed release notes, and version progression over time.

**RSS Feed** — Subscribe to \eed.xml\ for changelog updates in your favorite RSS reader.

---

### Performance & Offline

**Instant Return Visits** — IndexedDB caches bundles, icons, names, changelog, and release notes locally. Returning visitors see data instantly while fresh content loads in the background.

**Progressive Loading** — Bundles load in batches of 50 with a streaming progress bar. Partial results render as they arrive — no blank screens.

**Incremental Updates** — On return visits, only changed bundles are fetched by comparing timestamps and versions. Bandwidth-friendly.

**Icon Pipeline** — App icons are scraped from Google Play, resized to 96px, converted to WebP/JPEG data URLs, and cached in IndexedDB with LRU pruning (max 600 icons).

**Service Worker** — Stale-while-revalidate caching for data files, cache-first for static assets. Works offline after first visit.

**Device-Aware** — Auto-detects hardware tier via `navigator.hardwareConcurrency`. Low-end devices get reduced motion, simplified animations, and progressive icon loading.

---

### Accessibility & Polish

- **Dark Mode** — Full dark theme with glassmorphism cards and animated glow orb backgrounds
- **Responsive** — Works on desktop, tablet, and mobile
- **Keyboard Navigation** — Arrow keys in search, Enter/Space on cards, Escape to close modals
- **ARIA Labels** — Screen reader support on all interactive elements
- **Error Boundary** — Catches crashes, shows copy-pasteable error details, offers retry
- **Back to Top** — Appears after 300px scroll, smooth scroll back
- **Announcements** — Admin-pushable notifications via bell icon with priority levels

---

## Under the Hood

**Automated Pipeline** — A Python pipeline runs every 3 hours via GitHub Actions. It crawls GitHub's Git Trees API, downloads `.mpp` bundles, parses them, fingerprints changes with SHA-256, diffs against the previous snapshot, and writes static JSON files.

**Diff Engine** — Compares current vs previous snapshots at the bundle, app, and patch levels. SHA-256 fingerprinting with deterministic JSON canonicalization prevents false-positive change alerts.

**Atomic Writes** — All data files use temp-file-then-rename to prevent corruption from interrupted writes.

**Skip Cache** — Unchanged bundles are cached and skipped on subsequent runs, reducing API calls and runtime.

**Static JSON** — All data is served as static JSON files. No server, no database, no runtime costs. Vercel serves the build with SPA fallback routing.

---

## Quick Start

1. **Browse** — Visit the site. The dashboard shows today's updates immediately.
2. **Search** — Use the global search bar to find any app or bundle by name.
3. **Compare** — Click "Compare N bundles" on any app to see which bundle patches it best.
4. **Add** — Click "Add to Morphe" to deep-link the source directly into your manager.
5. **Watch** — Mark apps you care about to get notified when patches change.
6. **Subscribe** — Add \eed.xml\ to your RSS reader for ongoing changelog updates.

---

*MorpheTracker is an independent, community-maintained project. It is not affiliated with the Morphe project.*
