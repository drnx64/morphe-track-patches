import os
import json
import time
import requests
from bs4 import BeautifulSoup
from state_manager import STATE_DIR, load_json, save_json

CACHE_PATH = os.path.join(STATE_DIR, "icon_cache.json")
NAME_CACHE_PATH = os.path.join(STATE_DIR, "name_cache.json")

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


def fetch_and_cache_app_name(package_name):
    """Fetch app name from Play Store and cache it. Returns the name or empty string."""
    if not package_name or not isinstance(package_name, str):
        return ""

    pkg = package_name.lower().strip()
    cache = load_json(NAME_CACHE_PATH, default={})

    if pkg in cache:
        cached = cache[pkg]
        if isinstance(cached, str):
            return _clean_play_store_name(cached)
        return ""

    name = fetch_app_name_internal(pkg)
    cache[pkg] = name or ""
    save_json(NAME_CACHE_PATH, cache)
    return name or ""


def _clean_play_store_name(name):
    """Strip common Play Store suffixes from an app name."""
    suffixes = [
        " - Apps on Google Play",
        " - Google Play",
        " - Aplicaciones en Google Play",
        " - App su Google Play",
        " - Google Play のアプリ",
        " - Google Play 앱",
        " - Google Play 上的应用",
        " - Google Play 上的應用程式",
    ]
    for suffix in suffixes:
        if name.endswith(suffix):
            return name[: -len(suffix)].strip()
    return name


def fetch_app_name_internal(pkg):
    """Internal: fetch app name from Play Store without caching."""
    url = PLAY_STORE_URL.format(pkg)
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
    except requests.RequestException:
        return ""

    try:
        soup = BeautifulSoup(resp.text, "lxml")
        og_title = soup.find("meta", property="og:title")
        if og_title and og_title.get("content"):
            name = og_title["content"].strip()
            if name:
                return _clean_play_store_name(name)
    except Exception:
        pass

    try:
        title_tag = soup.find("title")
        if title_tag and title_tag.string:
            title = title_tag.string.strip()
            return _clean_play_store_name(title)
    except Exception:
        pass

    return ""


def enrich_parsed_bundles_with_names(parsed_bundles):
    """Enrich app names with Google Play Store names, falling back to existing names."""
    all_packages = set()
    for record in parsed_bundles.values():
        for app in record.get("apps", []):
            pkg = app.get("package", "").lower().strip()
            if pkg:
                all_packages.add(pkg)

    cache = load_json(NAME_CACHE_PATH, default={})
    uncached = [p for p in all_packages if p not in cache]

    if uncached:
        print(f"[names] Fetching Play Store names for {len(uncached)} uncached packages...")
        for i, pkg in enumerate(uncached):
            if i > 0 and i % 10 == 0:
                print(f"[names] Progress: {i}/{len(uncached)}")
            fetch_and_cache_app_name(pkg)
            if i < len(uncached) - 1:
                time.sleep(0.3)

    cache = load_json(NAME_CACHE_PATH, default={})

    for record in parsed_bundles.values():
        for app in record.get("apps", []):
            pkg = app.get("package", "").lower().strip()
            play_name = cache.get(pkg, "")
            if isinstance(play_name, str) and play_name:
                existing = app.get("app_name", "")
                if not existing or existing == pkg:
                    app["app_name"] = _clean_play_store_name(play_name)

    return parsed_bundles


def fetch_app_name(package_name, fallback_name=""):
    """Fetch the app display name from Google Play Store.

    Args:
        package_name: The Android package name (e.g. 'com.instagram.android')
        fallback_name: Name to return if Play Store fetch fails

    Returns:
        The app name from Play Store, or fallback_name if unavailable.
    """
    if not package_name or not isinstance(package_name, str):
        return fallback_name

    pkg = package_name.lower().strip()
    url = PLAY_STORE_URL.format(pkg)

    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
    except requests.RequestException:
        return fallback_name

    try:
        soup = BeautifulSoup(resp.text, "lxml")
        og_title = soup.find("meta", property="og:title")
        if og_title and og_title.get("content"):
            name = og_title["content"].strip()
            if name:
                return name
    except Exception:
        pass

    # Fallback: try the HTML title tag
    try:
        title_tag = soup.find("title")
        if title_tag and title_tag.string:
            title = title_tag.string.strip()
            # Play Store titles often end with " - Apps on Google Play"
            for suffix in [" - Apps on Google Play", " - Google Play"]:
                if title.endswith(suffix):
                    return title[: -len(suffix)].strip()
            return title
    except Exception:
        pass

    return fallback_name


if __name__ == "__main__":
    test_pkg = "com.instagram.android"
    url = fetch_app_icon(test_pkg)
    print(f"Icon URL for {test_pkg}: {url or '(not found)'}")
    name = fetch_app_name(test_pkg, "Instagram")
    print(f"App name for {test_pkg}: {name or '(not found)'}")
