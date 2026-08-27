import os
import sys
import json
import time
import base64
import random
import io
import requests
from PIL import Image
from bs4 import BeautifulSoup
from state_manager import STATE_DIR, load_json, save_json

CACHE_PATH = os.path.join(STATE_DIR, "icon_cache.json")
NAME_CACHE_PATH = os.path.join(STATE_DIR, "name_cache.json")

PLAY_STORE_URL = "https://play.google.com/store/apps/details?id={}"

MAX_RETRIES = 3
BASE_DELAY = 2

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "DNT": "1",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
}

ICON_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Dest": "image",
    "Sec-Fetch-Mode": "no-cors",
    "Sec-Fetch-Site": "cross-site",
}

session = requests.Session()


ICON_MAX_SIZE = 96


def _compress_icon(image_bytes):
    img = Image.open(io.BytesIO(image_bytes))
    img = img.convert("RGBA")
    img.thumbnail((ICON_MAX_SIZE, ICON_MAX_SIZE), Image.LANCZOS)
    bg = Image.new("RGBA", img.size, (0, 0, 0, 0))
    bg.paste(img, mask=img.split()[3])
    bg = bg.convert("RGB")
    buf = io.BytesIO()
    bg.save(buf, format="WEBP", quality=80, method=6)
    webp_bytes = buf.getvalue()
    buf2 = io.BytesIO()
    bg.save(buf2, format="JPEG", quality=80, optimize=True)
    jpeg_bytes = buf2.getvalue()
    if len(webp_bytes) <= len(jpeg_bytes):
        return base64.b64encode(webp_bytes).decode("utf-8"), "image/webp"
    return base64.b64encode(jpeg_bytes).decode("utf-8"), "image/jpeg"


def _url_to_data_url(image_bytes, content_type="image/png"):
    b64, final_type = _compress_icon(image_bytes)
    return f"data:{final_type};base64,{b64}"


def _detect_content_type(content_bytes):
    if content_bytes[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if content_bytes[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if content_bytes[:4] == b"GIF8":
        return "image/gif"
    if content_bytes[:4] == b"RIFF" and content_bytes[8:12] == b"WEBP":
        return "image/webp"
    return "image/png"


def _is_blocked_response(html_text):
    lower = html_text.lower()
    if "before you continue" in lower:
        return True
    if "consent.google" in lower:
        return True
    if "recaptcha" in lower:
        return True
    if "unusual traffic" in lower:
        return True
    if " automated queries" in lower:
        return True
    return False


def _fetch_page_with_retry(url, retries=MAX_RETRIES):
    for attempt in range(retries):
        try:
            resp = session.get(url, headers=HEADERS, timeout=15)
            resp.raise_for_status()
            if _is_blocked_response(resp.text):
                delay = BASE_DELAY * (2 ** attempt) + random.uniform(0, 1)
                print(f"  [blocked] attempt {attempt + 1}/{retries}, retrying in {delay:.1f}s...")
                time.sleep(delay)
                continue
            return resp
        except requests.RequestException as e:
            delay = BASE_DELAY * (2 ** attempt) + random.uniform(0, 1)
            print(f"  [error] attempt {attempt + 1}/{retries}: {e}, retrying in {delay:.1f}s...")
            time.sleep(delay)
    return None


def fetch_app_icon(package_name, skip_cache=False):
    if not package_name or not isinstance(package_name, str):
        return ""

    pkg = package_name.lower().strip()

    if not skip_cache:
        cache = load_json(CACHE_PATH, default={})
        if pkg in cache:
            cached = cache[pkg]
            if isinstance(cached, str) and cached and not cached.startswith("http"):
                return cached

    url = PLAY_STORE_URL.format(pkg)
    resp = _fetch_page_with_retry(url)
    if not resp:
        return ""

    icon_url = ""
    soup = BeautifulSoup(resp.text, "lxml")
    og_image = soup.find("meta", property="og:image")
    if og_image and og_image.get("content"):
        icon_url = str(og_image["content"]).strip()

    if not icon_url:
        return ""

    try:
        icon_resp = session.get(icon_url, headers=ICON_HEADERS, timeout=15)
        icon_resp.raise_for_status()
        content_type = icon_resp.headers.get("Content-Type", "image/png")
        if "jpeg" in content_type or "jpg" in content_type:
            content_type = "image/jpeg"
        elif "webp" in content_type:
            content_type = "image/webp"
        elif "gif" in content_type:
            content_type = "image/gif"
        else:
            content_type = _detect_content_type(icon_resp.content)

        data_url = _url_to_data_url(icon_resp.content, content_type)
        cache = load_json(CACHE_PATH, default={})
        cache[pkg] = data_url
        save_json(CACHE_PATH, cache)
        return data_url
    except requests.RequestException:
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
                time.sleep(random.uniform(0.3, 0.8))

        cache = load_json(CACHE_PATH, default={})

    for record in parsed_bundles.values():
        for app in record.get("apps", []):
            pkg = app.get("package", "").lower().strip()
            icon_data = cache.get(pkg, "")
            if isinstance(icon_data, str) and icon_data:
                app["icon_url"] = icon_data
            else:
                app["icon_url"] = ""

    return parsed_bundles


def retry_empty_icons():
    cache = load_json(CACHE_PATH, default={})
    empty_pkgs = [p for p, v in cache.items() if v == ""]

    if not empty_pkgs:
        print("[icons] No empty entries to retry.")
        return

    print(f"[icons] Retrying {len(empty_pkgs)} previously failed packages...")
    success = 0
    for i, pkg in enumerate(empty_pkgs):
        if i > 0 and i % 10 == 0:
            print(f"[icons] Retry progress: {i}/{len(empty_pkgs)} ({success} recovered)")
        result = fetch_app_icon(pkg, skip_cache=True)
        if result:
            success += 1
        if i < len(empty_pkgs) - 1:
            time.sleep(random.uniform(0.5, 1.2))

    print(f"[icons] Retry done: {success}/{len(empty_pkgs)} recovered")


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
    resp = _fetch_page_with_retry(url)
    if not resp:
        return ""

    soup = BeautifulSoup(resp.text, "lxml")

    og_title = soup.find("meta", property="og:title")
    if og_title and og_title.get("content"):
        name = str(og_title["content"]).strip()
        if name:
            return _clean_play_store_name(name)

    title_tag = soup.find("title")
    if title_tag and title_tag.string:
        title = str(title_tag.string).strip()
        return _clean_play_store_name(title)

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
                time.sleep(random.uniform(0.3, 0.8))

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
    """Fetch the app display name from Google Play Store (uses cache)."""
    name = fetch_and_cache_app_name(package_name)
    return name if name else fallback_name


if __name__ == "__main__":
    if "--retry-empty" in sys.argv:
        retry_empty_icons()
    elif "--stats" in sys.argv:
        cache = load_json(CACHE_PATH, default={})
        total = len(cache)
        data_urls = sum(1 for v in cache.values() if isinstance(v, str) and v.startswith("data:"))
        http_urls = sum(1 for v in cache.values() if isinstance(v, str) and v.startswith("http"))
        empty = sum(1 for v in cache.values() if isinstance(v, str) and v == "")
        missing = sum(1 for v in cache.values() if not isinstance(v, str) or v is None)
        print(f"Total: {total} | data URLs: {data_urls} | HTTP URLs: {http_urls} | empty: {empty} | invalid: {missing}")
    else:
        test_pkg = "com.instagram.android"
        result = fetch_app_icon(test_pkg)
        if result.startswith("data:"):
            print(f"Icon for {test_pkg}: [base64 data URL, {len(result)} chars]")
        else:
            print(f"Icon for {test_pkg}: {result or '(not found)'}")
        name = fetch_app_name(test_pkg, "Instagram")
        print(f"App name for {test_pkg}: {name or '(not found)'}")
