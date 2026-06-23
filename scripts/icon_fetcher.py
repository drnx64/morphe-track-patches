import os
import json
import time
import requests
from bs4 import BeautifulSoup
from state_manager import STATE_DIR, load_json, save_json

CACHE_PATH = os.path.join(STATE_DIR, "icon_cache.json")

PLAY_STORE_URL = "https://play.google.com/store/apps/details?id={}"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


def fetch_app_icon(package_name):
    if not package_name or not isinstance(package_name, str):
        return ""

    pkg = package_name.lower().strip()

    cache = load_json(CACHE_PATH, default={})

    if pkg in cache:
        cached = cache[pkg]
        if isinstance(cached, str):
            return cached
        return ""

    url = PLAY_STORE_URL.format(pkg)

    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
    except requests.RequestException:
        cache[pkg] = ""
        save_json(CACHE_PATH, cache)
        return ""

    try:
        soup = BeautifulSoup(resp.text, "lxml")
        og_image = soup.find("meta", property="og:image")
        if og_image and og_image.get("content"):
            icon_url = og_image["content"].strip()
            cache[pkg] = icon_url
            save_json(CACHE_PATH, cache)
            return icon_url
    except Exception:
        pass

    cache[pkg] = ""
    save_json(CACHE_PATH, cache)
    return ""


def enrich_parsed_bundles_with_icons(parsed_bundles):
    all_packages = set()
    for record in parsed_bundles.values():
        for app in record.get("apps", []):
            pkg = app.get("package", "").lower().strip()
            if pkg:
                all_packages.add(pkg)

    cache = load_json(CACHE_PATH, default={})
    uncached = [p for p in all_packages if p not in cache]

    if uncached:
        print(f"[icons] Fetching icons for {len(uncached)} uncached packages...")
        for i, pkg in enumerate(uncached):
            if i > 0 and i % 10 == 0:
                print(f"[icons] Progress: {i}/{len(uncached)}")
            fetch_app_icon(pkg)
            if i < len(uncached) - 1:
                time.sleep(0.3)

    cache = load_json(CACHE_PATH, default={})

    for record in parsed_bundles.values():
        for app in record.get("apps", []):
            pkg = app.get("package", "").lower().strip()
            icon_url = cache.get(pkg, "")
            if isinstance(icon_url, str) and icon_url:
                app["icon_url"] = icon_url
            else:
                app["icon_url"] = ""

    return parsed_bundles


if __name__ == "__main__":
    test_pkg = "com.instagram.android"
    url = fetch_app_icon(test_pkg)
    print(f"Icon URL for {test_pkg}: {url or '(not found)'}")
