import os
import sys
import subprocess
from datetime import datetime, timezone
from state_manager import (
    load_daily_buffer,
    save_daily_buffer,
    load_json,
    save_json,
    save_new_snapshot,
    save_live_json,
    load_current_snapshot,
    ensure_dirs,
    RAW_DIR,
    STATE_DIR,
    OUTPUT_DIR
)

APP_PRECEDENCE = {"NEW APP": 0, "UPDATED APP": 1, "REMOVED APP": 2}
BUNDLE_PRECEDENCE = {"NEW BUNDLE": 0, "UPDATED": 1}


def now_utc_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def build_changelog_entry(date_str, affected_bundles_dict):
    """Builds a structured changelog entry from the buffer's affected_bundles dict."""
    return {
        "date": date_str,
        "lastChecked": now_utc_iso(),
        "affected_bundles": list(affected_bundles_dict.values())
    }


def assign_scan_numbers(buffer_bundles, incoming, scan_counter):
    """Assign scan_numbers to incoming apps and merge into buffer."""
    for bundle_entry in incoming:
        b_key = f"{bundle_entry['bundle']}:{bundle_entry['channel']}"

        if b_key not in buffer_bundles:
            apps = []
            for a in bundle_entry.get("apps", []):
                app_entry = dict(a)
                app_entry["scan_numbers"] = [scan_counter]
                apps.append(app_entry)
            buffer_bundles[b_key] = {
                "bundle": bundle_entry["bundle"],
                "channel": bundle_entry["channel"],
                "badge_type": bundle_entry["badge_type"],
                "apps": apps
            }
        else:
            existing = buffer_bundles[b_key]
            if BUNDLE_PRECEDENCE.get(bundle_entry["badge_type"], 99) < BUNDLE_PRECEDENCE.get(existing["badge_type"], 99):
                existing["badge_type"] = bundle_entry["badge_type"]

            existing_app_map = {a["package"]: a for a in existing["apps"]}
            for app in bundle_entry.get("apps", []):
                if app["package"] not in existing_app_map:
                    new_app = dict(app)
                    new_app["scan_numbers"] = [scan_counter]
                    existing["apps"].append(new_app)
                else:
                    extant = existing_app_map[app["package"]]
                    if APP_PRECEDENCE.get(app["badge_type"], 99) < APP_PRECEDENCE.get(extant["badge_type"], 99):
                        extant["badge_type"] = app["badge_type"]
                    if scan_counter not in extant.get("scan_numbers", []):
                        extant.setdefault("scan_numbers", []).append(scan_counter)


def generate_markdown_changelog(date_str, affected_bundles_dict):
    """Generates a clean Markdown changelog block for the day."""
    lines = [f"## [{date_str}]"]

    snapshot = load_current_snapshot()

    def is_pre_release_app(bundle_name, package_name):
        stable_key = f"{bundle_name}:stable"
        dev_key = f"{bundle_name}:dev"
        stable_apps = snapshot.get(stable_key, {}).get("apps", [])
        dev_apps = snapshot.get(dev_key, {}).get("apps", [])
        in_stable = any(a["package"].lower().strip() == package_name.lower().strip() for a in stable_apps)
        in_dev = any(a["package"].lower().strip() == package_name.lower().strip() for a in dev_apps)
        return in_dev and not in_stable

    # Group by base bundle name
    updates_by_bundle = {}
    for b_key, info in affected_bundles_dict.items():
        b_name = info["bundle"]
        if b_name not in updates_by_bundle:
            updates_by_bundle[b_name] = {"channels": [], "apps": [], "badge_type": info["badge_type"]}
        if info["channel"] not in updates_by_bundle[b_name]["channels"]:
            updates_by_bundle[b_name]["channels"].append(info["channel"])
        for app in info.get("apps", []):
            existing = next((a for a in updates_by_bundle[b_name]["apps"] if a["package"] == app["package"]), None)
            if existing:
                if APP_PRECEDENCE.get(app["badge_type"], 99) < APP_PRECEDENCE.get(existing["badge_type"], 99):
                    existing["badge_type"] = app["badge_type"]
                app_scan = app.get("scan_numbers", [])
                if app_scan:
                    existing.setdefault("scan_numbers", [])
                    for sn in app_scan:
                        if sn not in existing["scan_numbers"]:
                            existing["scan_numbers"].append(sn)
            else:
                updates_by_bundle[b_name]["apps"].append(dict(app))
        if BUNDLE_PRECEDENCE.get(info["badge_type"], 99) < BUNDLE_PRECEDENCE.get(updates_by_bundle[b_name]["badge_type"], 99):
            updates_by_bundle[b_name]["badge_type"] = info["badge_type"]

    if not updates_by_bundle:
        lines.append("- No updates.")
        lines.append("")
        return "\n".join(lines)

    for b_name in sorted(updates_by_bundle.keys()):
        info = updates_by_bundle[b_name]
        is_new_bundle = info["badge_type"] == "NEW BUNDLE"

        if is_new_bundle:
            channels_str = ", ".join(sorted(info["channels"]))
            lines.append(f"- **NEW BUNDLE** Bundle by **{b_name}** ({channels_str})")
        else:
            lines.append(f"- **UPDATED** Bundle **{b_name}**")

        sorted_apps = sorted(info["apps"], key=lambda x: x["app_name"].lower())
        for app in sorted_apps:
            status = app["badge_type"]
            is_pre = is_pre_release_app(b_name, app["package"])
            pre_str = " [PRE-RELEASE]" if is_pre else ""
            lines.append(f"  - **{status}**{pre_str} {app['app_name']} (`{app['package']}`) in {b_name} patches")

    lines.append("")
    return "\n".join(lines)


def finalize_buffer(buffer_data):
    """
    Finalizes the daily buffer:
    1. Appends to data/output/changelog.json
    2. Prepends to data/output/changelog.md
    3. Writes the daily markdown changelog to data/output/today_changelog.md
    4. Generates data/live.json
    """
    ensure_dirs()
    date_str = buffer_data["date"]
    affected_bundles_dict = buffer_data.get("affected_bundles", {})

    # Skip finalization if the buffer has no changes (idempotency)
    if not affected_bundles_dict:
        print(f"[*] Skipping finalization for {date_str}: buffer is empty.")
        return

    print(f"[*] Finalizing daily buffer for date: {date_str}...")

    # 1. Update changelog.json
    changelog_json_path = os.path.join(OUTPUT_DIR, "changelog.json")
    changelog_json = load_json(changelog_json_path, default=[])

    changelog_json = [entry for entry in changelog_json if entry.get("date") != date_str]
    new_entry = build_changelog_entry(date_str, affected_bundles_dict)
    changelog_json.insert(0, new_entry)
    save_json(changelog_json_path, changelog_json)

    # 2. Update changelog.md
    changelog_md_path = os.path.join(OUTPUT_DIR, "changelog.md")
    daily_md = generate_markdown_changelog(date_str, affected_bundles_dict)

    today_changelog_path = os.path.join(OUTPUT_DIR, "today_changelog.md")
    with open(today_changelog_path, "w", encoding="utf-8") as f:
        f.write(daily_md)

    existing_md = ""
    if os.path.exists(changelog_md_path):
        try:
            with open(changelog_md_path, "r", encoding="utf-8") as f:
                existing_md = f.read()
        except Exception as e:
            print(f"Error reading changelog.md: {e}")

    header = "# Morphe Patch Tracker Changelog\n\n"
    if existing_md.startswith(header):
        content_body = existing_md[len(header):]
    else:
        content_body = existing_md

    with open(changelog_md_path, "w", encoding="utf-8") as f:
        f.write(header)
        f.write(daily_md)
        f.write(content_body)

    # 3. Update live.json
    snapshot = load_current_snapshot()

    unique_bundles = set()
    for key, b_rec in snapshot.items():
        name = key.split(':')[0]
        repo = b_rec.get("repo_url", "")
        unique_bundles.add((name, repo))
    total_bundles = len(unique_bundles)

    unique_packages = set()
    for b_rec in snapshot.values():
        for app in b_rec.get("apps", []):
            unique_packages.add(app["package"])
    total_apps = len(unique_packages)

    all_apps = []
    for b_info in affected_bundles_dict.values():
        all_apps.extend(b_info.get("apps", []))

    live_data = {
        "date": date_str,
        "last_run": now_utc_iso(),
        "lastChecked": now_utc_iso(),
        "stats": {
            "total_bundles": total_bundles,
            "total_apps": total_apps,
            "new_apps_today": len(set(a["package"] for a in all_apps if a.get("badge_type") == "NEW APP")),
            "new_bundles_today": len(set(b["bundle"] for b in affected_bundles_dict.values() if b.get("badge_type") == "NEW BUNDLE"))
        },
        "changes": {
            "affected_bundles": list(affected_bundles_dict.values())
        },
        "bundles": snapshot
    }
    save_live_json(live_data)
    print("[*] Finalization state files written successfully.")


def update_live_json_file(today_str, buffer_data, snapshot):
    """
    Updates data/live.json with the current snapshot and today's accumulated changes.
    """
    unique_bundles = set()
    for key, b_rec in snapshot.items():
        name = key.split(':')[0]
        repo = b_rec.get("repo_url", "")
        unique_bundles.add((name, repo))
    total_bundles = len(unique_bundles)

    unique_packages = set()
    for b_rec in snapshot.values():
        for app in b_rec.get("apps", []):
            unique_packages.add(app["package"])
    total_apps = len(unique_packages)

    # Load existing live.json to see if we should retain previous changes
    from state_manager import load_live_json
    existing_live = load_live_json()

    affected_bundles_list = list(buffer_data.get("affected_bundles", {}).values())
    has_new_changes = len(affected_bundles_list) > 0

    if not has_new_changes and existing_live and "changes" in existing_live:
        changes_to_save = existing_live["changes"]
        date_to_save = existing_live.get("date", today_str)
        new_apps_today = existing_live.get("stats", {}).get("new_apps_today", 0)
        new_bundles_today = existing_live.get("stats", {}).get("new_bundles_today", 0)
    else:
        all_apps = []
        for b_info in buffer_data.get("affected_bundles", {}).values():
            all_apps.extend(b_info.get("apps", []))
        changes_to_save = {
            "affected_bundles": affected_bundles_list
        }
        date_to_save = today_str
        new_apps_today = len(set(a["package"] for a in all_apps if a.get("badge_type") == "NEW APP"))
        new_bundles_today = len(set(b["bundle"] for b in buffer_data.get("affected_bundles", {}).values() if b.get("badge_type") == "NEW BUNDLE"))

    live_data = {
        "date": date_to_save,
        "last_run": now_utc_iso(),
        "lastChecked": now_utc_iso(),
        "stats": {
            "total_bundles": total_bundles,
            "total_apps": total_apps,
            "new_apps_today": new_apps_today,
            "new_bundles_today": new_bundles_today
        },
        "changes": changes_to_save,
        "bundles": snapshot
    }
    save_live_json(live_data)
    print("[*] Live state file (live.json) updated with the current snapshot.")


def update_daily_buffer_run():
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    buffer_data = load_daily_buffer()

    # If the buffer date is from a previous day, finalize it first
    finalized = False
    if buffer_data.get("date") and buffer_data["date"] != today_str:
        if buffer_data.get("affected_bundles"):
            finalize_buffer(buffer_data)
            finalized = True
        else:
            print(f"[*] Older buffer found for {buffer_data['date']} but it was empty. Skipping finalization.")

        buffer_data = {
            "date": today_str,
            "lastChecked": now_utc_iso(),
            "scan_counter": 0,
            "affected_bundles": {}
        }
    elif not buffer_data.get("date"):
        buffer_data = {
            "date": today_str,
            "lastChecked": now_utc_iso(),
            "scan_counter": 0,
            "affected_bundles": {}
        }
    else:
        buffer_data["lastChecked"] = now_utc_iso()

    # Load current run diff
    diff_path = os.path.join(RAW_DIR, "diff_result.json")
    diff_result = load_json(diff_path, default={"affected_bundles": []})
    incoming = diff_result.get("affected_bundles", [])

    # Increment scan counter if there are incoming changes
    scan_counter = buffer_data.get("scan_counter", 0)
    if incoming:
        scan_counter += 1
        buffer_data["scan_counter"] = scan_counter

    # Merge incoming affected_bundles into buffer with scan numbers
    buffer_bundles = buffer_data.setdefault("affected_bundles", {})
    assign_scan_numbers(buffer_bundles, incoming, scan_counter)

    # Save daily buffer
    save_daily_buffer(buffer_data)

    # Save the parsed bundles as the new current snapshot (and rotate rollbacks)
    new_snapshot_path = os.path.join(RAW_DIR, "parsed_bundles.json")
    new_snapshot = load_json(new_snapshot_path, default={})
    if new_snapshot:
        save_new_snapshot(new_snapshot)
        print("[*] Current snapshot updated and rollbacks rotated.")

        # Always update live.json with the latest snapshot and today's accumulated changes
        update_live_json_file(today_str, buffer_data, new_snapshot)

    # If we finalized a previous day, trigger site generation and notification
    if finalized:
        print("[*] Running site generator...")
        gen_script = os.path.join(os.path.dirname(__file__), "generate_site.py")
        subprocess.run([sys.executable, gen_script], check=True)

        print("[*] Running Telegram notifications...")
        notify_script = os.path.join(os.path.dirname(__file__), "telegram_notify.py")
        today_changelog_path = os.path.join(OUTPUT_DIR, "today_changelog.md")
        subprocess.run([
            sys.executable,
            notify_script,
            "--title", "Morphe Patch Update",
            "--filepath", today_changelog_path
        ], check=True)

        try:
            os.remove(today_changelog_path)
        except:
            pass

    # If --finalize argument is passed, force finalization of the current day
    elif len(sys.argv) > 1 and sys.argv[1] == "--finalize":
        if buffer_data.get("affected_bundles"):
            finalize_buffer(buffer_data)

            buffer_data = {
                "date": today_str,
                "lastChecked": now_utc_iso(),
                "affected_bundles": {}
            }
            save_daily_buffer(buffer_data)

            print("[*] Running site generator (forced finalization)...")
            gen_script = os.path.join(os.path.dirname(__file__), "generate_site.py")
            subprocess.run([sys.executable, gen_script], check=True)

            print("[*] Running Telegram notifications (forced finalization)...")
            notify_script = os.path.join(os.path.dirname(__file__), "telegram_notify.py")
            today_changelog_path = os.path.join(OUTPUT_DIR, "today_changelog.md")
            subprocess.run([
                sys.executable,
                notify_script,
                "--title", "Morphe Patch Update",
                "--filepath", today_changelog_path
            ], check=True)

            try:
                os.remove(today_changelog_path)
            except:
                pass
        else:
            print("[*] Force finalization skipped: daily buffer is empty.")


if __name__ == "__main__":
    ensure_dirs()
    update_daily_buffer_run()
