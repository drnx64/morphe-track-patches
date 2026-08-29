"""Populate icon_cache.json and name_cache.json from committed bundle data."""
import os
import sys
import time
import json
import random

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from state_manager import ROOT_DATA_DIR, STATE_DIR, load_json, save_json, ensure_dirs

BUNDLES_DIR = os.path.join(ROOT_DATA_DIR, "bundles")
CACHE_PATH = os.path.join(STATE_DIR, "icon_cache.json")
NAME_CACHE_PATH = os.path.join(STATE_DIR, "name_cache.json")


def extract_all_packages():
    """Extract unique package names from all committed bundle files."""
    packages = set()
    for fname in os.listdir(BUNDLES_DIR):
        if fname.startswith("_") or not fname.endswith(".json"):
            continue
        fpath = os.path.join(BUNDLES_DIR, fname)
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                bundle = json.load(f)
            for app in bundle.get("apps", []):
                pkg = app.get("package", "").lower().strip()
                if pkg:
                    packages.add(pkg)
        except Exception as e:
            print(f"  [warn] skipping {fname}: {e}")
    return sorted(packages)


def main():
    ensure_dirs()
    packages = extract_all_packages()
    print(f"Found {len(packages)} unique packages in committed bundles.")

    icon_cache = load_json(CACHE_PATH, default={})
    name_cache = load_json(NAME_CACHE_PATH, default={})

    uncached_icons = [p for p in packages if p not in icon_cache]
    uncached_names = [p for p in packages if p not in name_cache]

    print(f"Icon cache: {len(icon_cache)} existing, {len(uncached_icons)} to fetch")
    print(f"Name cache: {len(name_cache)} existing, {len(uncached_names)} to fetch")

    # Fetch icons
    if uncached_icons:
        from icon_fetcher import fetch_app_icon
        print(f"\nFetching {len(uncached_icons)} icons from Play Store...")
        for i, pkg in enumerate(uncached_icons):
            if i > 0 and i % 10 == 0:
                print(f"  Icon progress: {i}/{len(uncached_icons)}")
                # Re-read cache to see what was saved
                icon_cache = load_json(CACHE_PATH, default={})
                filled = sum(1 for v in icon_cache.values() if isinstance(v, str) and v.startswith("data:"))
                print(f"    ({filled} icons in cache so far)")
            fetch_app_icon(pkg)
            time.sleep(random.uniform(0.3, 0.8))
        print(f"  Icon progress: {len(uncached_icons)}/{len(uncached_icons)} (done)")

    # Fetch names
    uncached_names_final = [p for p in packages if p not in name_cache]
    if uncached_names_final:
        from icon_fetcher import fetch_and_cache_app_name
        print(f"\nFetching {len(uncached_names_final)} names from Play Store...")
        for i, pkg in enumerate(uncached_names_final):
            if i > 0 and i % 10 == 0:
                print(f"  Name progress: {i}/{len(uncached_names_final)}")
            fetch_and_cache_app_name(pkg)
            time.sleep(random.uniform(0.3, 0.8))
        print(f"  Name progress: {len(uncached_names_final)}/{len(uncached_names_final)} (done)")

    # Final stats
    icon_cache = load_json(CACHE_PATH, default={})
    name_cache = load_json(NAME_CACHE_PATH, default={})
    filled_icons = sum(1 for v in icon_cache.values() if isinstance(v, str) and v.startswith("data:"))
    filled_names = sum(1 for v in name_cache.values() if isinstance(v, str) and v)
    print(f"\nFinal: {filled_icons} icons with data, {filled_names} names with data")
    print(f"  icon_cache.json: {os.path.getsize(CACHE_PATH) / 1024:.0f} KB")
    print(f"  name_cache.json: {os.path.getsize(NAME_CACHE_PATH) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
