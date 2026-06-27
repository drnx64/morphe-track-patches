import os
import shutil
import json
from datetime import datetime, timezone
from xml.sax.saxutils import escape as xml_escape
from state_manager import ensure_dirs, DOCS_DIR, DOCS_DATA_DIR, OUTPUT_DIR, save_json, load_json


def _read_file(path):
    """Read a file from disk, returning '' if missing."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        return ""


INDEX_HTML_PATH = os.path.join(DOCS_DIR, "index.html")
CHANGELOG_HTML_PATH = os.path.join(DOCS_DIR, "changelog.html")
STYLE_CSS_PATH = os.path.join(DOCS_DIR, "assets", "style.css")
APP_JS_PATH = os.path.join(DOCS_DIR, "assets", "app.js")


def _rfc2822(date_str):
    """Convert YYYY-MM-DD to RFC 2822 date string."""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        return dt.strftime("%a, %d %b %Y %H:%M:%S +0000")
    except Exception:
        return datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")


def _build_item_description(bundle_entry):
    """Build an HTML description snippet for a changelog item."""
    lines = []
    badge = bundle_entry.get("badge_type", "UPDATED")
    channel = bundle_entry.get("channel", bundle_entry.get("channels", ["unknown"]))
    if isinstance(channel, list):
        channel = ", ".join(channel)
    lines.append(f"<p><strong>{badge}</strong> — channel: {channel}</p>")
    apps = bundle_entry.get("apps", [])
    if apps:
        lines.append("<ul>")
        for app in apps:
            bt = app.get("badge_type", "CHANGED")
            name = app.get("app_name", app.get("package", "unknown"))
            lines.append(f"<li>[{bt}] {xml_escape(name)}</li>")
        lines.append("</ul>")
    return "".join(lines)


def generate_rss_feed():
    """Generate RSS 2.0 and Atom feed from changelog data."""
    changelog_path = os.path.join(OUTPUT_DIR, "changelog.json")
    if not os.path.exists(changelog_path):
        print("No changelog.json found, skipping RSS generation.")
        return

    changelog = load_json(changelog_path)
    if not changelog:
        print("Changelog is empty, skipping RSS generation.")
        return

    site_url = "https://drnx64.github.io/morphe-track-patches"
    feed_url = f"{site_url}/feed.xml"
    now_rfc = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")

    items = []
    for day in changelog:
        date_str = day.get("date", "")
        affected = day.get("affected_bundles", [])
        for bundle_entry in affected:
            bundle_name = bundle_entry.get("bundle", "unknown")
            title = f"[{bundle_entry.get('badge_type', 'UPDATED')}] {bundle_name} patches — {date_str}"
            desc = _build_item_description(bundle_entry)
            guid = f"{site_url}/changelog.html#{bundle_name}-{date_str}"
            pub_date = _rfc2822(date_str)
            items.append({
                "title": title,
                "description": desc,
                "guid": guid,
                "pubDate": pub_date,
                "link": f"{site_url}/index.html#bundle={bundle_name}"
            })

    # RSS 2.0
    rss_items = []
    for item in reversed(items):  # newest first
        rss_items.append(f"""    <item>
      <title>{xml_escape(item['title'])}</title>
      <link>{xml_escape(item['link'])}</link>
      <description>{xml_escape(item['description'])}</description>
      <pubDate>{item['pubDate']}</pubDate>
      <guid isPermaLink="false">{xml_escape(item['guid'])}</guid>
    </item>""")

    rss_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Morphe Patch Tracker — Changelog</title>
    <link>{xml_escape(site_url)}</link>
    <description>Automated changelog tracking Morphe patch bundle updates across stable and dev channels.</description>
    <language>en</language>
    <lastBuildDate>{now_rfc}</lastBuildDate>
    <atom:link href="{xml_escape(feed_url)}" rel="self" type="application/rss+xml"/>
{chr(10).join(rss_items)}
  </channel>
</rss>"""

    rss_path = os.path.join(DOCS_DIR, "feed.xml")
    with open(rss_path, "w", encoding="utf-8") as f:
        f.write(rss_xml)
    print(f"Writing RSS feed ({len(items)} items)...")


def generate_static_files():
    ensure_dirs()

    # 1. Write HTML files by reading from disk
    index_html = _read_file(INDEX_HTML_PATH)
    changelog_html = _read_file(CHANGELOG_HTML_PATH)
    style_css = _read_file(STYLE_CSS_PATH)
    app_js = _read_file(APP_JS_PATH)

    if index_html:
        with open(os.path.join(DOCS_DIR, "index.html"), "w", encoding="utf-8") as f:
            f.write(index_html)
        print("Writing index.html...")

    if changelog_html:
        with open(os.path.join(DOCS_DIR, "changelog.html"), "w", encoding="utf-8") as f:
            f.write(changelog_html)
        print("Writing changelog.html...")

    # 2. Write CSS and JS files
    assets_dir = os.path.join(DOCS_DIR, "assets")
    os.makedirs(assets_dir, exist_ok=True)

    if style_css:
        with open(os.path.join(assets_dir, "style.css"), "w", encoding="utf-8") as f:
            f.write(style_css)
        print("Writing style.css...")

    if app_js:
        with open(os.path.join(assets_dir, "app.js"), "w", encoding="utf-8") as f:
            f.write(app_js)
        print("Writing app.js...")

    # 3. Copy changelog.json to data/changelog.json
    changelog_src = os.path.join(OUTPUT_DIR, "changelog.json")
    changelog_dest = os.path.join(DOCS_DATA_DIR, "changelog.json")
    if os.path.exists(changelog_src):
        print(f"Copying {changelog_src} to {changelog_dest}...")
        shutil.copy2(changelog_src, changelog_dest)
    else:
        save_json(changelog_dest, [])

    print("Static site generated successfully in the root directory.")


if __name__ == "__main__":
    generate_static_files()
