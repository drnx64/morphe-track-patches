"""Fetch app metadata from Google Play Store.

Uses google_play_scraper to get: name, iconUrl, description, minInstalls, category.
Stores results in data/state/app_store_cache.json.
"""
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(__file__))

from state_manager import STATE_DIR, load_json, save_json

APP_STORE_CACHE_PATH = os.path.join(STATE_DIR, "app_store_cache.json")
CONCURRENCY = 5


def _fetch_app_details(package_name):
    """Fetch app details from Google Play Store. Returns dict or None."""
    try:
        from google_play_scraper import app as gplay_app
        from google_play_scraper.exceptions import NotFoundError
    except ImportError:
        print("[-] google_play_scraper not installed. Run: pip install google-play-scraper")
        return None

    try:
        result = gplay_app(package_name, lang="en", country="us")
        if not result:
            return None
        icon_url = result.get("icon") or ""
        # Normalize icon URL — remove sizing parameters for consistency
        if "googleusercontent.com" in icon_url:
            icon_url = icon_url.split("=")[0] if "=" in icon_url else icon_url
        return {
            "name": result.get("title") or "",
            "iconUrl": icon_url,
            "description": (result.get("summary") or "")[:500],
            "minInstalls": result.get("minInstalls") or 0,
            "category": result.get("genre") or "",
        }
    except NotFoundError:
        return {"name": "", "iconUrl": "", "description": "", "minInstalls": 0, "category": ""}
    except Exception as e:
        print(f"[-] Error fetching {package_name}: {e}")
        return None


def process(apps_dict, mode="daily"):
    """Fetch Google Play metadata for apps.

    Args:
        apps_dict: dict mapping package_name -> app metadata dict (mutated in place).
        mode: 'weekly' refreshes all apps, 'daily' only missing fields.
    """
    try:
        from google_play_scraper import app as _test_import
    except ImportError:
        print("[-] google_play_scraper not installed, skipping Play Store scrape")
        return

    if mode == "weekly":
        apps_to_scrape = list(apps_dict.keys())
    else:
        apps_to_scrape = [
            pkg for pkg, data in apps_dict.items()
            if any(data.get(field) is None for field in ("name", "iconUrl", "description", "minInstalls", "category"))
        ]

    if not apps_to_scrape:
        print("[gplay] All apps have metadata, nothing to scrape")
        return

    print(f"[gplay] Scraping Google Play for {len(apps_to_scrape)} apps (mode: {mode})...")

    success = 0
    failed = 0

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
        future_to_pkg = {
            executor.submit(_fetch_app_details, pkg): pkg
            for pkg in apps_to_scrape
        }
        for i, future in enumerate(as_completed(future_to_pkg)):
            pkg = future_to_pkg[future]
            try:
                details = future.result()
                if details is None:
                    failed += 1
                    continue
                current = apps_dict[pkg]
                for key, value in details.items():
                    if value is not None and value != "":
                        current[key] = value
                # Ensure all fields exist
                for field in ("name", "iconUrl", "description"):
                    if current.get(field) is None:
                        current[field] = ""
                if not current.get("minInstalls"):
                    current["minInstalls"] = 0
                if current.get("category") is None:
                    current["category"] = ""
                success += 1
            except Exception as e:
                print(f"[-] Error processing {pkg}: {e}")
                failed += 1

            if (i + 1) % 50 == 0:
                print(f"[gplay] Progress: {i + 1}/{len(apps_to_scrape)} ({success} ok, {failed} failed)")

    print(f"[gplay] Done: {success} updated, {failed} failed")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Fetch Google Play Store metadata")
    parser.add_argument("--weekly", action="store_true", help="Full refresh (all apps)")
    args = parser.parse_args()

    # Load existing app store cache or create from bundle data
    store_cache = load_json(APP_STORE_CACHE_PATH, default={})

    # Also load from app_cache.json to get existing names/icons
    app_cache_path = os.path.join(STATE_DIR, "app_cache.json")
    app_cache = load_json(app_cache_path, default={})

    # Merge into store cache
    for pkg, entry in app_cache.items():
        if pkg not in store_cache:
            store_cache[pkg] = {}
        if isinstance(entry, dict):
            if entry.get("name") and not store_cache[pkg].get("name"):
                store_cache[pkg]["name"] = entry["name"]
            if entry.get("icon_url") and not store_cache[pkg].get("iconUrl"):
                store_cache[pkg]["iconUrl"] = entry["icon_url"]

    mode = "weekly" if args.weekly else "daily"
    process(store_cache, mode=mode)

    save_json(APP_STORE_CACHE_PATH, store_cache)
    print(f"[gplay] Saved {len(store_cache)} apps to {APP_STORE_CACHE_PATH}")


if __name__ == "__main__":
    main()
