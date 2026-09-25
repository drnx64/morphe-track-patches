"""Generate ASCII-markers changelog for Telegram notifications.

Reads daily_buffer.json + parsed_bundles.json to produce the diff.
Output goes to scripts/temp/whats-new.md.
Supports multi-message splitting when content exceeds Telegram's 4096 char limit.
"""
import os
import sys
import json
from datetime import datetime, timezone
from urllib.parse import quote

sys.path.insert(0, os.path.dirname(__file__))

from state_manager import (
    DAILY_BUFFER_PATH, RAW_DIR, ROOT_DATA_DIR,
    load_json, ensure_dirs,
)
from icon_fetcher import APP_CACHE_PATH
from config import SITE_URL

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "temp")
TG_MAX_LEN = 4000


def _load_app_name(pkg, app_cache):
    entry = app_cache.get(pkg, {})
    if isinstance(entry, dict):
        return entry.get("name", "") or pkg
    return pkg


def _get_patches_for_app(bundle_name, pkg, parsed_bundles):
    for key, rec in parsed_bundles.items():
        if rec.get("bundle", "") == bundle_name:
            for app in rec.get("apps", []):
                if app.get("package", "").lower() == pkg.lower():
                    return [p.get("name", "unknown") for p in app.get("patches", [])]
    return []


def _patch_link(patch_name, pkg):
    if not pkg:
        return patch_name
    url = f"{SITE_URL}/?open-app={quote(pkg, safe='')}&patch={quote(patch_name, safe='')}"
    return f'<a href="{url}">{patch_name}</a>'


def _build_sections(entries, app_cache, parsed_bundles):
    sections = {"new_bundles": [], "new_apps": [], "updated_apps": []}

    for bundle_key, entry in entries.items():
        bundle_name = entry.get("bundle", bundle_key.split(":")[0])
        badge_type = entry.get("badge_type", "")
        patches_name = entry.get("patches_name", "") or bundle_name
        apps = entry.get("apps", [])

        if badge_type == "NEW BUNDLE":
            app_items = []
            for app in apps:
                pkg = app.get("package", "")
                app_name = _load_app_name(pkg, app_cache) or app.get("app_name", pkg)
                pd = app.get("patch_diff", {})
                added = pd.get("patches_added", [])

                patches = []
                if added:
                    for p in added:
                        patches.append({"name": p.get("name", "unknown"), "badge": "+", "pkg": pkg})
                else:
                    for pn in _get_patches_for_app(bundle_name, pkg, parsed_bundles):
                        patches.append({"name": pn, "badge": "+", "pkg": pkg})

                if patches:
                    app_items.append({"name": app_name, "patches": patches, "pkg": pkg})

            if app_items:
                sections["new_bundles"].append({
                    "bundle_name": bundle_name, "patches_name": patches_name, "apps": app_items,
                })

        elif badge_type == "UPDATED":
            new_app_items = []
            updated_app_items = []

            for app in apps:
                pkg = app.get("package", "")
                app_name = _load_app_name(pkg, app_cache) or app.get("app_name", pkg)
                app_badge = app.get("badge_type", "")
                pd = app.get("patch_diff", {})
                added = pd.get("patches_added", [])
                removed = pd.get("patches_removed", [])
                modified = pd.get("patches_modified", [])

                patches = []
                for p in added:
                    patches.append({"name": p.get("name", "unknown"), "badge": "+", "pkg": pkg})
                for p in modified:
                    patches.append({"name": p.get("name", "unknown"), "badge": "~", "pkg": pkg})
                for p in removed:
                    patches.append({"name": p.get("name", "unknown"), "badge": "-", "pkg": pkg})

                if app_badge == "NEW APP":
                    if not patches:
                        for pn in _get_patches_for_app(bundle_name, pkg, parsed_bundles):
                            patches.append({"name": pn, "badge": "+", "pkg": pkg})
                    if patches:
                        new_app_items.append({"name": app_name, "patches": patches, "pkg": pkg})
                elif app_badge in ("UPDATED APP", "MAJOR UPDATE"):
                    if patches:
                        updated_app_items.append({"name": app_name, "patches": patches, "pkg": pkg})
                elif app_badge == "REMOVED APP":
                    updated_app_items.append({"name": app_name, "patches": [], "removed": True, "pkg": pkg})

            if new_app_items:
                sections["new_apps"].append({
                    "bundle_name": bundle_name, "patches_name": patches_name, "apps": new_app_items,
                })
            if updated_app_items:
                sections["updated_apps"].append({
                    "bundle_name": bundle_name, "patches_name": patches_name, "apps": updated_app_items,
                })

        elif badge_type == "REMOVED BUNDLE":
            app_items = []
            for app in apps:
                pkg = app.get("package", "")
                app_name = app.get("app_name", pkg)
                app_items.append({"name": app_name, "patches": [], "removed": True, "pkg": pkg})
            if app_items:
                sections["updated_apps"].append({
                    "bundle_name": bundle_name, "patches_name": patches_name, "apps": app_items,
                })

    return sections


def _dedup_sections(sections):
    for key in sections:
        seen = {}
        for item in sections[key]:
            bname = item["bundle_name"]
            if bname not in seen or len(item.get("apps", [])) > len(seen[bname].get("apps", [])):
                seen[bname] = item
        sections[key] = list(seen.values())
    return sections


def _render_bundle(item):
    """Render a single bundle as a block of lines."""
    lines = []
    lines.append(f'# <b>{item["patches_name"]}</b>')

    apps = item.get("apps", [])
    for app in apps:
        if app.get("removed"):
            lines.append(f'    - <s>{app["name"]}</s>')
            continue
        lines.append(f'    - <b>{app["name"]}</b>')
        for patch in app.get("patches", []):
            badge = patch["badge"]
            pkg = patch.get("pkg", "")
            name = patch["name"]
            if badge == "-":
                lines.append(f'        {badge} {name}')
            else:
                lines.append(f'        {badge} {_patch_link(name, pkg)}')

    return "\n".join(lines)


def _render_header():
    lines = []
    today = datetime.now(timezone.utc)
    date_str = today.strftime("%B %d, %Y")
    lines.append("<b>[TODAY'S UPDATES]</b>")
    lines.append(f"Date: {date_str}")
    return "\n".join(lines)


SECTION_LABELS = {
    "new_bundles": "<b>[NEW BUNDLES]</b>",
    "new_apps": "<b>[UPDATED BUNDLES: NEW APPS]</b>",
    "updated_apps": "<b>[UPDATED BUNDLES: UPDATED APPS]</b>",
}

BUNDLE_PREFIX = "# "


def _render_full(sections):
    """Render full changelog, returning list of bundle blocks with section headers."""
    blocks = []
    blocks.append(_render_header())

    for key in ["new_bundles", "new_apps", "updated_apps"]:
        items = sections.get(key, [])
        if not items:
            continue
        blocks.append("")
        blocks.append(SECTION_LABELS[key])
        for item in items:
            blocks.append("")
            blocks.append(_render_bundle(item))

    return "\n".join(blocks)


def _split_into_chunks(full_text):
    """Split text into chunks, keeping bundles whole."""
    if len(full_text) <= TG_MAX_LEN:
        return [full_text]

    header = _render_header()
    chunks = []
    current = header

    lines = full_text.split("\n")
    i = 0

    # Skip header lines (already used)
    while i < len(lines) and lines[i] != "":
        i += 1

    while i < len(lines):
        line = lines[i]

        # Start a new bundle block at "# " (bundle header) or section header
        if line.startswith(BUNDLE_PREFIX) or line in SECTION_LABELS.values():
            bundle_lines = [line]
            i += 1
            # Collect all lines until next bundle header or section header or end
            while i < len(lines):
                next_line = lines[i]
                if next_line.startswith(BUNDLE_PREFIX) or next_line in SECTION_LABELS.values():
                    break
                bundle_lines.append(next_line)
                i += 1

            bundle_block = "\n".join(bundle_lines)
            candidate = current + "\n" + bundle_block if current else bundle_block

            if len(candidate) > TG_MAX_LEN and current != header:
                chunks.append(current)
                current = header + "\n\n" + bundle_block
            else:
                current = candidate
        else:
            # Section header, blank line, etc. — attach to current
            candidate = current + "\n" + line if current else line
            if len(candidate) > TG_MAX_LEN:
                chunks.append(current)
                current = header + "\n\n" + line
            else:
                current = candidate
            i += 1

    if current:
        chunks.append(current)

    return chunks


def generate_whats_new():
    """Generate the changelog diff from daily buffer.

    Returns list[str] — one chunk per Telegram message.
    """
    ensure_dirs()
    buffer = load_json(DAILY_BUFFER_PATH, default={})
    entries = buffer.get("affected_bundles", {})
    if not entries:
        print("[-] No daily buffer entries")
        return None

    app_cache = load_json(APP_CACHE_PATH, default={})
    parsed_path = os.path.join(RAW_DIR, "parsed_bundles.json")
    parsed_bundles = load_json(parsed_path, default={})

    sections = _build_sections(entries, app_cache, parsed_bundles)
    sections = _dedup_sections(sections)

    if not any(sections.values()):
        print("[-] No changes to report")
        return None

    MAX_BUNDLES = 8
    MAX_APPS = 6
    MAX_PATCHES = 5
    for key in sections:
        sections[key] = sections[key][:MAX_BUNDLES]
        for item in sections[key]:
            item["apps"] = item["apps"][:MAX_APPS]
            for app in item["apps"]:
                if not app.get("removed") and len(app.get("patches", [])) > MAX_PATCHES:
                    remaining = len(app["patches"]) - MAX_PATCHES
                    app["patches"] = app["patches"][:MAX_PATCHES]
                    app["patches"].append({"name": f"+{remaining} more", "badge": "*", "pkg": ""})

    full_text = _render_full(sections)
    chunks = _split_into_chunks(full_text)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    md_path = os.path.join(OUTPUT_DIR, "whats-new.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(chunks[0])
    print(f"[+] Wrote {md_path} ({len(chunks)} chunk{'s' if len(chunks) > 1 else ''})")

    json_path = os.path.join(OUTPUT_DIR, "whats-new.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({
            "chunks": chunks,
            "total_chunks": len(chunks),
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        }, f, indent=2)

    return chunks


if __name__ == "__main__":
    result = generate_whats_new()
    if result:
        for i, chunk in enumerate(result):
            print(f"\n--- Chunk {i + 1}/{len(result)} ({len(chunk)} chars) ---")
            print(chunk)
