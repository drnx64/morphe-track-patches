"""One-off cleanup: purge phantom changelog entries and orphan bundle files.

Background (fixed in pipeline, this script cleans the history):
- data/bundles/*.json orphan files (keys no longer in _index.json) were
  resurrected into the CI snapshot by the rebuild-from-files fallback,
  producing false "REMOVED BUNDLE"/"REMOVED APP" entries every run
  (poisoned days: 2026-09-16 and 2026-09-24..2026-10-01).
- Jman<->external identity flips produced matching false "NEW BUNDLE" entries.

This script:
1. Prunes data/bundles/<key>.json files whose key is not in _index.json.
2. Rewrites data/state/current_snapshot.json from _index.json (orphans out).
3. Removes phantom entries from:
   - data/changelog.json        (historical days)
   - data/changes.json          (today's accumulated changes)
   - data/state/daily_buffer.json (today's scan buffer)

Phantom criteria:
 REMOVED BUNDLE: bundle:channel still in index, OR bundle name still in
   index or Jman tree, OR repo_url still in index, OR repo still sourced
   by the external index (added/errors), OR the key only exists via an
   orphaned bundle file (snapshot-rebuild fallback artifacts).
 NEW BUNDLE: key no longer in index while its repo_url still is (flip).

Usage:
    python scripts/cleanup_phantoms.py           # dry run (report only)
    python scripts/cleanup_phantoms.py --apply   # write changes
"""
import argparse
import json
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from state_manager import (
    ROOT_DATA_DIR, STATE_DIR, RAW_DIR, BUNDLES_DIR, load_json, save_json,
    repo_slug,
)

CHANGELOG_PATH = os.path.join(ROOT_DATA_DIR, "changelog.json")
CHANGES_PATH = os.path.join(ROOT_DATA_DIR, "changes.json")
BUFFER_PATH = os.path.join(STATE_DIR, "daily_buffer.json")


def load_universe():
    index = load_json(os.path.join(BUNDLES_DIR, "_index.json"), default={})
    index_keys = set(index)
    index_names = {e.get("bundle", "").lower() for e in index.values() if e.get("bundle")}
    index_repos = {e.get("repo_url", "").lower().rstrip("/") for e in index.values() if e.get("repo_url")}

    orphan_files = set()
    if os.path.isdir(BUNDLES_DIR):
        expected = {key.replace(":", "_") + ".json" for key in index_keys}
        orphan_files = {
            f for f in os.listdir(BUNDLES_DIR)
            if f.endswith(".json") and f != "_index.json" and f not in expected
        }

    tree_names = set()
    tree_files = load_json(os.path.join(RAW_DIR, "tree.json"), default=[])
    if tree_files:
        from download_bundles import group_tree_files
        tree_names = {n.lower() for n in group_tree_files(tree_files)}

    ext_repos = set()
    ext = load_json(os.path.join(STATE_DIR, "external_repos.json"), default={}) or {}
    for entry in ext.get("added", []):
        owner = str(entry.get("owner", "")).lower()
        repo = str(entry.get("repo", "")).lower()
        if owner and repo:
            ext_repos.add(f"{owner}/{repo}")
    for entry in ext.get("errors", []):
        repo = str(entry.get("repo", "")).lower().strip().strip("/")
        if repo:
            ext_repos.add(repo)

    return {
        "index_keys": index_keys,
        "index_names": index_names,
        "index_repos": index_repos,
        "orphan_files": orphan_files,
        "tree_names": tree_names,
        "ext_repos": ext_repos,
    }


def _via_orphan_file(entry, uni):
    filename = f"{entry.get('bundle', '')}_{entry.get('channel', '')}.json"
    return filename in uni["orphan_files"]


def is_phantom_removal(entry, uni):
    key = f"{entry.get('bundle', '')}:{entry.get('channel', '')}"
    if key in uni["index_keys"]:
        return True
    if _via_orphan_file(entry, uni):
        return True
    name = entry.get("bundle", "").lower()
    if name in uni["index_names"] or name in uni["tree_names"]:
        return True
    repo = entry.get("repo_url", "").lower().rstrip("/")
    if repo and repo in uni["index_repos"]:
        return True
    slug = repo_slug(entry.get("repo_url", ""))
    return bool(slug) and slug in uni["ext_repos"]


def is_phantom_new(entry, uni):
    key = f"{entry.get('bundle', '')}:{entry.get('channel', '')}"
    if key in uni["index_keys"]:
        return False
    repo = entry.get("repo_url", "").lower().rstrip("/")
    return bool(repo) and repo in uni["index_repos"]


def purge_entries(entries, uni):
    """Return (kept_entries, removed_removals, removed_news)."""
    kept, n_rem, n_new = [], 0, 0
    for entry in entries:
        badge = entry.get("badge_type", "")
        if badge == "REMOVED BUNDLE" and is_phantom_removal(entry, uni):
            n_rem += 1
            continue
        if badge == "NEW BUNDLE" and is_phantom_new(entry, uni):
            n_new += 1
            continue
        kept.append(entry)
    return kept, n_rem, n_new


def prune_orphan_files(uni, apply):
    if not os.path.isdir(BUNDLES_DIR):
        return 0
    expected = {key.replace(":", "_") + ".json" for key in uni["index_keys"]}
    removed = 0
    for filename in sorted(os.listdir(BUNDLES_DIR)):
        if filename == "_index.json" or not filename.endswith(".json"):
            continue
        if filename not in expected:
            removed += 1
            if apply:
                os.remove(os.path.join(BUNDLES_DIR, filename))
    return removed


def rewrite_current_snapshot(uni, apply):
    path = os.path.join(STATE_DIR, "current_snapshot.json")
    snapshot = load_json(path, default={})
    if not snapshot:
        return 0, 0
    kept = {k: v for k, v in snapshot.items() if k in uni["index_keys"]}
    dropped = len(snapshot) - len(kept)
    if apply and dropped:
        save_json(path, kept)
    return len(snapshot), dropped


def process_list(path, uni, apply):
    """Purge phantom entries from a JSON file with a top-level
    affected_bundles list (data/changes.json).

    Returns (total, kept, n_rem, n_new) or None when the file is absent.
    """
    if not os.path.exists(path):
        return None
    data = load_json(path, default=None)
    if data is None:
        return None
    entries = data.get("affected_bundles", []) if isinstance(data, dict) else data
    total = len(entries)
    kept, n_rem, n_new = purge_entries(entries, uni)
    if apply and (n_rem or n_new):
        if isinstance(data, dict):
            data["affected_bundles"] = kept
            save_json(path, data)
        else:
            save_json(path, kept)
    return total, len(kept), n_rem, n_new


def process_changelog(uni, apply):
    if not os.path.exists(CHANGELOG_PATH):
        return []
    changelog = load_json(CHANGELOG_PATH, default=[])
    report = []
    dirty = False
    for day in changelog:
        entries = day.get("affected_bundles", [])
        kept, n_rem, n_new = purge_entries(entries, uni)
        if n_rem or n_new:
            day["affected_bundles"] = kept
            dirty = True
        report.append((day.get("date", "?"), len(entries), len(kept), n_rem, n_new))
    if apply and dirty:
        save_json(CHANGELOG_PATH, changelog)
    return report


def process_buffer(uni, apply):
    if not os.path.exists(BUFFER_PATH):
        return None
    buffer_data = load_json(BUFFER_PATH, default=None)
    if not buffer_data:
        return None
    entries = list(buffer_data.get("affected_bundles", {}).values())
    kept, n_rem, n_new = purge_entries(entries, uni)
    if apply and (n_rem or n_new):
        buffer_data["affected_bundles"] = {
            f"{e.get('bundle', '')}:{e.get('channel', '')}": e for e in kept
        }
        save_json(BUFFER_PATH, buffer_data)
    return len(entries), len(kept), n_rem, n_new


def main():
    parser = argparse.ArgumentParser(description="Purge phantom changelog entries and orphan bundle files")
    parser.add_argument("--apply", action="store_true", help="write changes (default is dry run)")
    args = parser.parse_args()

    mode = "APPLY" if args.apply else "DRY RUN"
    print(f"=== cleanup_phantoms ({mode}) ===")

    uni = load_universe()
    print(f"Universe: {len(uni['index_keys'])} index keys, "
          f"{len(uni['index_names'])} names, {len(uni['tree_names'])} tree names, "
          f"{len(uni['ext_repos'])} external repos")

    orphans = prune_orphan_files(uni, args.apply)
    print(f"\nOrphan bundle files: {orphans}")

    total, dropped = rewrite_current_snapshot(uni, args.apply)
    print(f"Current snapshot: {total} keys, {dropped} orphan keys dropped")

    print("\nChangelog:")
    for date, before, after, n_rem, n_new in process_changelog(uni, args.apply):
        if n_rem or n_new:
            print(f"  {date}: {before} -> {after} entries (-{n_rem} phantom REMOVED, -{n_new} phantom NEW)")

    print("\nChanges (today):")
    result = process_list(CHANGES_PATH, uni, args.apply)
    if result:
        total, kept, n_rem, n_new = result
        print(f"  {total} -> {kept} entries (-{n_rem} phantom REMOVED, -{n_new} phantom NEW)")

    print("\nDaily buffer (today):")
    result = process_buffer(uni, args.apply)
    if result:
        total, kept, n_rem, n_new = result
        print(f"  {total} -> {kept} entries (-{n_rem} phantom REMOVED, -{n_new} phantom NEW)")

    if not args.apply:
        print("\nDry run — no files changed. Re-run with --apply to write.")


if __name__ == "__main__":
    main()
