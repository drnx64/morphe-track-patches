"""Fast icon/name cache population - batch approach with shared cache."""
import os
import sys
import time
import json
import random
import threading

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from state_manager import ROOT_DATA_DIR, STATE_DIR, load_json, save_json, ensure_dirs

BUNDLES_DIR = os.path.join(ROOT_DATA_DIR, "bundles")
CACHE_PATH = os.path.join(STATE_DIR, "icon_cache.json")
NAME_CACHE_PATH = os.path.join(STATE_DIR, "name_cache.json")

_lock = threading.Lock()


def extract_all_packages():
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
        except Exception:
            pass
    return sorted(packages)


def fetch_icon_batch(pkgs):
    """Fetch icons for a batch of packages, saving incrementally."""
    from icon_fetcher import fetch_app_icon
    success = 0
    for pkg in pkgs:
        try:
            result = fetch_app_icon(pkg)
            if result and result.startswith("data:"):
                success += 1
        except Exception:
            pass
        time.sleep(random.uniform(0.2, 0.5))
    return success


def fetch_name_batch(pkgs):
    """Fetch names for a batch of packages."""
    from icon_fetcher import fetch_and_cache_app_name
    success = 0
    for pkg in pkgs:
        try:
            result = fetch_and_cache_app_name(pkg)
            if result:
                success += 1
        except Exception:
            pass
        time.sleep(random.uniform(0.2, 0.5))
    return success


def main():
    ensure_dirs()
    packages = extract_all_packages()
    print(f"Found {len(packages)} unique packages.")

    icon_cache = load_json(CACHE_PATH, default={})
    name_cache = load_json(NAME_CACHE_PATH, default={})

    uncached_icons = [p for p in packages if p not in icon_cache]
    print(f"Icons: {len(icon_cache)} cached, {len(uncached_icons)} to fetch")

    # Fetch icons in batches of 50
    if uncached_icons:
        batch_size = 50
        total_ok = 0
        total_fail = 0
        for start in range(0, len(uncached_icons), batch_size):
            batch = uncached_icons[start:start + batch_size]
            ok = fetch_icon_batch(batch)
            total_ok += ok
            total_fail += len(batch) - ok
            print(f"  Batch {start // batch_size + 1}: {ok}/{len(batch)} ok | Total: {total_ok + total_fail}/{len(uncached_icons)}")
            time.sleep(1)

    # Fetch names
    name_cache = load_json(NAME_CACHE_PATH, default={})
    uncached_names = [p for p in packages if p not in name_cache]
    print(f"\nNames: {len(name_cache)} cached, {len(uncached_names)} to fetch")

    if uncached_names:
        batch_size = 50
        total_ok = 0
        for start in range(0, len(uncached_names), batch_size):
            batch = uncached_names[start:start + batch_size]
            ok = fetch_name_batch(batch)
            total_ok += ok
            print(f"  Batch {start // batch_size + 1}: {ok}/{len(batch)} ok | Total: {total_ok}/{len(uncached_names)}")
            time.sleep(1)

    # Final stats
    icon_cache = load_json(CACHE_PATH, default={})
    name_cache = load_json(NAME_CACHE_PATH, default={})
    filled_icons = sum(1 for v in icon_cache.values() if isinstance(v, str) and v.startswith("data:"))
    filled_names = sum(1 for v in name_cache.values() if isinstance(v, str) and v)
    print(f"\nFinal: {filled_icons} icons, {filled_names} names")
    print(f"  icon_cache.json: {os.path.getsize(CACHE_PATH) / 1024:.0f} KB")
    print(f"  name_cache.json: {os.path.getsize(NAME_CACHE_PATH) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
