import os
import sys
import subprocess
from datetime import datetime
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

def build_changelog_entry(date_str, bundles_dict, apps_list):
    """Formats a structured dictionary for the changelog."""
    return {
        "date": date_str,
        "new_bundles": list(bundles_dict.values()),
        "new_apps": apps_list
    }

def generate_markdown_changelog(date_str, bundles_dict, apps_list):
    """Generates a clean Markdown changelog block for the day."""
    lines = [f"## [{date_str}]"]
    
    from state_manager import load_current_snapshot
    snapshot = load_current_snapshot()
    
    # Helper to check if an app package is pre-release (in dev but not stable in the snapshot)
    def is_pre_release_app(bundle_name, package_name, current_snapshot):
        stable_key = f"{bundle_name}:stable"
        dev_key = f"{bundle_name}:dev"
        stable_apps = current_snapshot.get(stable_key, {}).get("apps", [])
        dev_apps = current_snapshot.get(dev_key, {}).get("apps", [])
        in_stable = any(a["package"].lower().strip() == package_name.lower().strip() for a in stable_apps)
        in_dev = any(a["package"].lower().strip() == package_name.lower().strip() for a in dev_apps)
        return in_dev and not in_stable

    # Group updates by base bundle name
    updates_by_bundle = {}
    
    # 1. Add new bundles to grouping
    for b_key, info in bundles_dict.items():
        b_name = info['bundle']
        if b_name not in updates_by_bundle:
            updates_by_bundle[b_name] = { "new_channels": [], "apps": [] }
        if info['channel'] not in updates_by_bundle[b_name]["new_channels"]:
            updates_by_bundle[b_name]["new_channels"].append(info['channel'])
            
    # 2. Add apps to grouping and deduplicate by package name
    for app in apps_list:
        b_name = app["bundle"].split(':')[0]
        if b_name not in updates_by_bundle:
            updates_by_bundle[b_name] = { "new_channels": [], "apps": [] }
            
        existing_packages = [a["package"] for a in updates_by_bundle[b_name]["apps"]]
        if app["package"] not in existing_packages:
            updates_by_bundle[b_name]["apps"].append(app)
            
    if not updates_by_bundle:
        lines.append("- No updates.")
        lines.append("")
        return "\n".join(lines)
        
    # Sort bundles alphabetically to keep layout predictable
    for b_name in sorted(updates_by_bundle.keys()):
        info = updates_by_bundle[b_name]
        is_new_bundle = len(info["new_channels"]) > 0
        
        if is_new_bundle:
            channels_str = ", ".join(sorted(info["new_channels"]))
            lines.append(f"- **NEW BUNDLE** Bundle by **{b_name}** ({channels_str})")
        else:
            lines.append(f"- **Bundle {b_name}**")
            
        # Sort apps alphabetically within the bundle
        sorted_apps = sorted(info["apps"], key=lambda x: x["app_name"].lower())
        for app in sorted_apps:
            status = app.get("status", "new").upper()
            is_pre = is_pre_release_app(b_name, app["package"], snapshot)
            pre_str = " [PRE-RELEASE]" if is_pre else ""
            lines.append(f"  - **{status} APP**{pre_str} {app['app_name']} (`{app['package']}`) in {b_name} patches")
            
    lines.append("") # Empty line separator
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
    bundles = buffer_data["bundles"]
    apps = buffer_data["apps"]
    
    print(f"[*] Finalizing daily buffer for date: {date_str}...")
    
    # 1. Update changelog.json
    changelog_json_path = os.path.join(OUTPUT_DIR, "changelog.json")
    changelog_json = load_json(changelog_json_path, default=[])
    
    # Avoid duplicate entries for the same date
    changelog_json = [entry for entry in changelog_json if entry.get("date") != date_str]
    new_entry = build_changelog_entry(date_str, bundles, apps)
    changelog_json.insert(0, new_entry)
    save_json(changelog_json_path, changelog_json)
    
    # 2. Update changelog.md
    changelog_md_path = os.path.join(OUTPUT_DIR, "changelog.md")
    daily_md = generate_markdown_changelog(date_str, bundles, apps)
    
    # Write temp file for Telegram notify
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
    
    # Calculate stats
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
    
    live_data = {
        "date": date_str,
        "last_run": datetime.now().isoformat(),
        "stats": {
            "total_bundles": total_bundles,
            "total_apps": total_apps,
            "new_apps_today": len(set(a["package"] for a in apps if a.get("status", "new") == "new")),
            "new_bundles_today": len(set(b["bundle"] for b in bundles.values()))
        },
        "changes": {
            "new_bundles": list(bundles.values()),
            "new_apps": apps
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
    
    new_bundles = list(buffer_data.get("bundles", {}).values())
    new_apps = buffer_data.get("apps", [])
    
    has_new_changes = len(new_bundles) > 0 or len(new_apps) > 0
    
    if not has_new_changes and existing_live and "changes" in existing_live:
        changes_to_save = existing_live["changes"]
        date_to_save = existing_live.get("date", today_str)
        new_apps_today = existing_live.get("stats", {}).get("new_apps_today", 0)
        new_bundles_today = existing_live.get("stats", {}).get("new_bundles_today", 0)
    else:
        changes_to_save = {
            "new_bundles": new_bundles,
            "new_apps": new_apps
        }
        date_to_save = today_str
        new_apps_today = len(set(a["package"] for a in new_apps if a.get("status", "new") == "new"))
        new_bundles_today = len(set(b["bundle"] for b in buffer_data.get("bundles", {}).values()))

    live_data = {
        "date": date_to_save,
        "last_run": datetime.now().isoformat(),
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
    today_str = datetime.now().strftime("%Y-%m-%d")
    buffer_data = load_daily_buffer()
    
    # If the buffer date is from a previous day, finalize it first
    finalized = False
    if buffer_data.get("date") and buffer_data["date"] != today_str:
        # Check if the old buffer actually contains changes before finalization
        if buffer_data.get("bundles") or buffer_data.get("apps"):
            finalize_buffer(buffer_data)
            finalized = True
        else:
            print(f"[*] Older buffer found for {buffer_data['date']} but it was empty. Skipping finalization.")
            
        # Reset the buffer for the new day
        buffer_data = {
            "date": today_str,
            "bundles": {},
            "apps": []
        }
    elif not buffer_data.get("date"):
        # Initialize buffer
        buffer_data = {
            "date": today_str,
            "bundles": {},
            "apps": []
        }
        
    # Load current run diff
    diff_path = os.path.join(RAW_DIR, "diff_result.json")
    diff_result = load_json(diff_path, default={"new_bundles": [], "new_apps": [], "updated_apps": [], "removed_apps": []})
    
    new_bundles = diff_result.get("new_bundles", [])
    new_apps = diff_result.get("new_apps", [])
    updated_apps = diff_result.get("updated_apps", [])
    removed_apps = diff_result.get("removed_apps", [])
    
    # Merge current run changes into buffer
    # 1. Bundles (key is bundle_name:channel)
    for b in new_bundles:
        b_key = f"{b['bundle']}:{b['channel']}"
        if b_key not in buffer_data["bundles"]:
            buffer_data["bundles"][b_key] = b
            
    # 2. Apps (duplicate check on bundle + package with status precedence)
    existing_apps = { (a["bundle"], a["package"]): a for a in buffer_data.get("apps", []) }
    
    def merge_apps_with_status(app_list, status_val):
        for app in app_list:
            app_key = (app["bundle"], app["package"])
            if app_key not in existing_apps:
                new_app_entry = {
                    "bundle": app["bundle"],
                    "app_name": app["app_name"],
                    "package": app["package"],
                    "status": status_val
                }
                buffer_data["apps"].append(new_app_entry)
                existing_apps[app_key] = new_app_entry
            else:
                # App already exists in daily buffer, resolve status priority: new > updated > removed
                existing = existing_apps[app_key]
                old_status = existing.get("status", "new")
                if status_val == "new" and old_status in ["updated", "removed"]:
                    existing["status"] = "new"
                elif status_val == "updated" and old_status == "removed":
                    existing["status"] = "updated"

    merge_apps_with_status(new_apps, "new")
    merge_apps_with_status(updated_apps, "updated")
    merge_apps_with_status(removed_apps, "removed")
            
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
        # Run generate_site.py
        print("[*] Running site generator...")
        gen_script = os.path.join(os.path.dirname(__file__), "generate_site.py")
        subprocess.run([sys.executable, gen_script], check=True)
        
        # Run telegram_notify.py
        print("[*] Running Telegram notifications...")
        notify_script = os.path.join(os.path.dirname(__file__), "telegram_notify.py")
        today_changelog_path = os.path.join(OUTPUT_DIR, "today_changelog.md")
        subprocess.run([
            sys.executable, 
            notify_script, 
            "--title", "Morphe Patch Update", 
            "--filepath", today_changelog_path
        ], check=True)
        
        # Clean up temp file
        try:
            os.remove(today_changelog_path)
        except:
            pass

    # If --finalize argument is passed, force finalization of the current day
    elif len(sys.argv) > 1 and sys.argv[1] == "--finalize":
        if buffer_data.get("bundles") or buffer_data.get("apps"):
            finalize_buffer(buffer_data)
            
            # Reset buffer for new day (or next run)
            buffer_data = {
                "date": today_str,
                "bundles": {},
                "apps": []
            }
            save_daily_buffer(buffer_data)
            
            # Run generate_site.py
            print("[*] Running site generator (forced finalization)...")
            gen_script = os.path.join(os.path.dirname(__file__), "generate_site.py")
            subprocess.run([sys.executable, gen_script], check=True)
            
            # Run telegram_notify.py
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
