import os
import sys
from state_manager import (
    load_current_snapshot,
    load_json,
    save_json,
    save_last_run,
    load_last_run,
    ensure_dirs,
    RAW_DIR
)

def diff_snapshots():
    new_snapshot_path = os.path.join(RAW_DIR, "parsed_bundles.json")
    new_snapshot = load_json(new_snapshot_path, default={})
    old_snapshot = load_current_snapshot() # This is data/state/current_snapshot.json
    
    new_bundles = []
    new_apps = []
    updated_apps = []
    removed_apps = []
    
    # Process each bundle:channel in the new snapshot
    for bundle_key, new_rec in new_snapshot.items():
        bundle_name = new_rec["bundle"]
        channel = new_rec["channel"]
        new_apps_list = new_rec.get("apps", [])
        
        if bundle_key not in old_snapshot:
            # Entirely new bundle+channel
            print(f"[+] Diff: Found new bundle {bundle_key}")
            new_bundles.append({
                "bundle": bundle_name,
                "channel": channel
            })
            
            # All apps in this bundle are considered new
            for app in new_apps_list:
                new_apps.append({
                    "bundle": bundle_key,
                    "app_name": app["app_name"],
                    "package": app["package"]
                })
        else:
            # Existing bundle+channel, check fingerprint
            old_rec = old_snapshot[bundle_key]
            new_fp = new_rec.get("fingerprint")
            old_fp = old_rec.get("fingerprint")
            
            if new_fp != old_fp:
                old_fp_display = old_fp[:8] if old_fp else "None"
                new_fp_display = new_fp[:8] if new_fp else "None"
                print(f"[+] Diff: Bundle {bundle_key} fingerprint changed ({old_fp_display} -> {new_fp_display})")
                
                # Check for new, updated, and removed apps
                old_app_map = {app["package"].lower().strip(): app for app in old_rec.get("apps", [])}
                new_app_map = {app["package"].lower().strip(): app for app in new_apps_list}
                
                for pkg, app in new_app_map.items():
                    if pkg not in old_app_map:
                        print(f"[+] Diff: Found new app {app['app_name']} ({pkg}) in {bundle_key}")
                        new_apps.append({
                            "bundle": bundle_key,
                            "app_name": app["app_name"],
                            "package": app["package"]
                        })
                    else:
                        # Fingerprint changed and app still exists: it was updated
                        print(f"[~] Diff: Found updated app {app['app_name']} ({pkg}) in {bundle_key}")
                        updated_apps.append({
                            "bundle": bundle_key,
                            "app_name": app["app_name"],
                            "package": app["package"]
                        })
                
                for pkg, app in old_app_map.items():
                    if pkg not in new_app_map:
                        print(f"[-] Diff: Found removed app {app['app_name']} ({pkg}) in {bundle_key}")
                        removed_apps.append({
                            "bundle": bundle_key,
                            "app_name": app["app_name"],
                            "package": app["package"]
                        })
            else:
                # Fingerprints match, skip diffing
                pass

    has_changes = (len(new_bundles) > 0 or len(new_apps) > 0 or len(updated_apps) > 0 or len(removed_apps) > 0)
    
    # Update last_run.json
    last_run_data = load_last_run()
    last_run_data["has_changes"] = has_changes
    last_run_data["new_bundles_count"] = len(new_bundles)
    last_run_data["new_apps_count"] = len(new_apps)
    save_last_run(last_run_data)
    
    if not has_changes:
        print("[*] No changes detected. Short-circuiting execution.")
        # Save empty diff
        save_json(os.path.join(RAW_DIR, "diff_result.json"), {
            "new_bundles": [],
            "new_apps": [],
            "updated_apps": [],
            "removed_apps": []
        })
        return False
        
    # Save diff result
    diff_data = {
        "new_bundles": new_bundles,
        "new_apps": new_apps,
        "updated_apps": updated_apps,
        "removed_apps": removed_apps
    }
    save_json(os.path.join(RAW_DIR, "diff_result.json"), diff_data)
    print(f"Diff complete. Found {len(new_bundles)} new bundles, {len(new_apps)} new apps, {len(updated_apps)} updated apps, and {len(removed_apps)} removed apps.")
    return True

if __name__ == "__main__":
    ensure_dirs()
    diff_snapshots()
