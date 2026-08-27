import sys
import os
import time
import random
import base64
import io

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from PIL import Image
from icon_fetcher import _compress_icon, ICON_MAX_SIZE
from state_manager import load_json, save_json

CACHE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public", "data", "state", "icon_cache.json")

BATCH_SIZE = 20
DELAY_RANGE = (0.5, 1.5)


def recompress_data_url(data_url):
    try:
        header, b64data = data_url.split(",", 1)
        raw = base64.b64decode(b64data)
        new_b64, new_type = _compress_icon(raw)
        return f"data:{new_type};base64,{new_b64}"
    except Exception:
        return None


def main():
    cache = load_json(CACHE_PATH, default={})

    if "--recompress" in sys.argv:
        entries = [(pkg, url) for pkg, url in cache.items()
                   if isinstance(url, str) and url.startswith("data:")]

        if not entries:
            print("No data URL entries to recompress.")
            return

        print(f"Recompressing {len(entries)} data URL entries to {ICON_MAX_SIZE}x{ICON_MAX_SIZE} WebP/JPEG...")
        stats = {"processed": 0, "compressed": 0, "skipped": 0, "total": len(entries)}
        orig_total = sum(len(url) for _, url in entries)

        for i, (pkg, data_url) in enumerate(entries):
            stats["processed"] += 1
            old_len = len(data_url)
            new_url = recompress_data_url(data_url)
            if new_url and len(new_url) < old_len:
                cache[pkg] = new_url
                stats["compressed"] += 1
                savings = old_len - len(new_url)
                print(f"  [{stats['processed']}/{stats['total']}] {pkg}: {old_len} -> {len(new_url)} (-{savings})")
            else:
                stats["skipped"] += 1

            if i < len(entries) - 1:
                time.sleep(random.uniform(0.1, 0.3))

            if stats["processed"] % BATCH_SIZE == 0:
                save_json(CACHE_PATH, cache)
                print(f"  >> checkpoint ({stats['processed']}/{stats['total']})")

        save_json(CACHE_PATH, cache)
        new_total = sum(len(url) for url in cache.values() if isinstance(url, str) and url.startswith("data:"))
        print(f"\nDone!")
        print(f"  Processed:  {stats['processed']}")
        print(f"  Compressed: {stats['compressed']}")
        print(f"  Skipped:    {stats['skipped']}")
        print(f"  Size:       {orig_total // 1024}KB -> {new_total // 1024}KB")

    elif "--convert-http" in sys.argv:
        from icon_fetcher import session, _fetch_page_with_retry, _url_to_data_url, _detect_content_type, ICON_HEADERS

        entries = [(pkg, url) for pkg, url in cache.items()
                   if isinstance(url, str) and url.startswith("http")]

        if not entries:
            print("No HTTP URLs to convert.")
            return

        print(f"Converting {len(entries)} HTTP URLs to compressed data URLs...")
        stats = {"processed": 0, "success": 0, "failed": 0, "total": len(entries)}

        for i, (pkg, icon_url) in enumerate(entries):
            stats["processed"] += 1
            try:
                icon_resp = session.get(icon_url, headers=ICON_HEADERS, timeout=15)
                icon_resp.raise_for_status()
                new_url = _url_to_data_url(icon_resp.content)
                cache[pkg] = new_url
                stats["success"] += 1
                print(f"  [{stats['processed']}/{stats['total']}] {pkg}: OK ({len(new_url)} chars)")
            except Exception:
                stats["failed"] += 1
                print(f"  [{stats['processed']}/{stats['total']}] {pkg}: FAILED")

            if i < len(entries) - 1:
                time.sleep(random.uniform(*DELAY_RANGE))

            if stats["processed"] % BATCH_SIZE == 0:
                save_json(CACHE_PATH, cache)
                print(f"  >> checkpoint ({stats['processed']}/{stats['total']})")

        save_json(CACHE_PATH, cache)
        print(f"\nDone! Success: {stats['success']}, Failed: {stats['failed']}")

    else:
        print("Usage:")
        print("  python batch_convert_icons.py --recompress     Recompress existing data URLs to 96x96 WebP/JPEG")
        print("  python batch_convert_icons.py --convert-http   Convert HTTP URLs to compressed data URLs")


if __name__ == "__main__":
    main()
