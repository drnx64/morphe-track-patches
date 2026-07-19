import os
import re
import shutil
import json
from datetime import datetime, timezone
from xml.sax.saxutils import escape as xml_escape
from state_manager import ensure_dirs, ROOT_DIR, ROOT_DATA_DIR, OUTPUT_DIR, save_json, load_json

PUBLIC_DATA_DIR = os.path.join(ROOT_DIR, "public", "data")
REPOS_LIST_PATH = os.path.join(ROOT_DATA_DIR, "repos_list.txt")
README_PATH = os.path.join(ROOT_DIR, "README.md")


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

    site_url = os.environ.get("SITE_URL", "https://drnx64.github.io/morphe-track-patches")
    feed_url = f"{site_url}/feed.xml"
    now_rfc = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")

    items = []
    for day in changelog:
        date_str = day.get("date", "")
        affected = day.get("affected_bundles", [])
        for bundle_entry in affected:
            bundle_name = bundle_entry.get("bundle", "unknown")
            channel = bundle_entry.get("channel", "unknown")
            apps = bundle_entry.get("apps", [])
            badge = bundle_entry.get("badge_type", "UPDATED")
            for app in apps:
                bt = app.get("badge_type", "CHANGED")
                app_name = app.get("app_name", app.get("package", "unknown"))
                title = f"[{bt}] {app_name} in {bundle_name}"
                desc = (
                    f"<p><strong>{bt}</strong> &mdash; {xml_escape(app_name)} "
                    f"in {xml_escape(bundle_name)} ({channel}) &mdash; {date_str}</p>"
                )
                guid = f"{site_url}/changelog.html#{bundle_name}-{channel}-{date_str}-{app.get('package', app_name)}"
                pub_date = _rfc2822(date_str)
                items.append({
                    "title": title,
                    "description": desc,
                    "guid": guid,
                    "pubDate": pub_date,
                    "link": f"{site_url}/index.html#bundle={bundle_name}"
                })
            if not apps:
                title = f"[{badge}] {bundle_name} patches — {date_str}"
                desc = _build_item_description(bundle_entry)
                guid = f"{site_url}/changelog.html#{bundle_name}-{channel}-{date_str}"
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

    rss_path = os.path.join(ROOT_DIR, "feed.xml")
    with open(rss_path, "w", encoding="utf-8") as f:
        f.write(rss_xml)
    print(f"Writing RSS feed ({len(items)} items)...")


def generate_static_files():
    ensure_dirs()

    # Copy changelog.json to data/changelog.json (for frontend access)
    changelog_src = os.path.join(OUTPUT_DIR, "changelog.json")
    changelog_dest = os.path.join(ROOT_DATA_DIR, "changelog.json")
    if os.path.exists(changelog_src):
        print(f"Copying {changelog_src} to {changelog_dest}...")
        shutil.copy2(changelog_src, changelog_dest)
    else:
        save_json(changelog_dest, [])

    # Sync all data files to public/data/ (used by Vite dev server)
    os.makedirs(PUBLIC_DATA_DIR, exist_ok=True)
    for filename in ["core.json", "stats.json", "changes.json", "bundles.json", "changelog.json", "repos_list.txt"]:
        src = os.path.join(ROOT_DATA_DIR, filename)
        dst = os.path.join(PUBLIC_DATA_DIR, filename)
        if os.path.exists(src):
            print(f"Syncing {src} -> {dst}...")
            shutil.copy2(src, dst)

    # Also sync state/ subdirectory
    state_src = os.path.join(ROOT_DATA_DIR, "state")
    state_dst = os.path.join(PUBLIC_DATA_DIR, "state")
    if os.path.exists(state_src):
        os.makedirs(state_dst, exist_ok=True)
        for fname in os.listdir(state_src):
            fsrc = os.path.join(state_src, fname)
            fdst = os.path.join(state_dst, fname)
            if os.path.isfile(fsrc):
                shutil.copy2(fsrc, fdst)

    # Update README repos table
    update_readme_repos_table()

    print("Static site files synced to data/ and public/data/.")


def update_readme_repos_table():
    """Update the repository table in README.md from repos_list.txt."""
    if not os.path.exists(REPOS_LIST_PATH):
        print("No repos_list.txt found, skipping README update.")
        return

    if not os.path.exists(README_PATH):
        print("No README.md found, skipping README update.")
        return

    repos = []
    with open(REPOS_LIST_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            m = re.match(r"^([^/]+/[^/#\s]+)\s*->\s*(https://\S+)", line)
            if m:
                owner_repo = m.group(1)
                url = m.group(2)
                author = owner_repo.split("/")[0]
                repos.append((owner_repo, url, author))

    if not repos:
        print("No repos parsed from repos_list.txt, skipping README update.")
        return

    # Generate table rows
    table_rows = []
    for i, (owner_repo, url, author) in enumerate(sorted(repos, key=lambda x: x[0].lower()), 1):
        table_rows.append(
            f"| {i} | [{owner_repo}]({url}) | [@{author}](https://github.com/{author}) |"
        )

    table_header = f"| # | Repo | Author |\n|---|------|--------|\n"
    table_body = "\n".join(table_rows)

    with open(README_PATH, "r", encoding="utf-8") as f:
        readme = f.read()

    start_marker = "Thanks to every developer who publishes Morphe patches."
    end_marker = "Missing or new? Check"

    start_idx = readme.find(start_marker)
    end_idx = readme.find(end_marker)

    if start_idx == -1 or end_idx == -1:
        print("Could not find table markers in README.md, skipping update.")
        return

    start_line_end = readme.index("\n", start_idx) + 1
    end_line_start = readme.rindex("\n", 0, end_idx) + 1

    new_replacement = "\n" + table_header + table_body + "\n\n"

    updated_readme = readme[:start_line_end] + new_replacement + readme[end_line_start:]

    total = len(repos)
    updated_readme = re.sub(
        r'\(\d+\+? repos\)',
        f'({total} repos)',
        updated_readme
    )

    with open(README_PATH, "w", encoding="utf-8") as f:
        f.write(updated_readme)

    print(f"README.md updated with {total} repositories in the table.")


if __name__ == "__main__":
    generate_static_files()
