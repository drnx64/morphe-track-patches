import os
import sys
from datetime import datetime, timezone
from state_manager import (
    load_current_snapshot,
    load_json,
    save_json,
    save_last_run,
    load_last_run,
    ensure_dirs,
    RAW_DIR
)

def apps_are_different(old_app, new_app):
    """
    Checks if there are actual differences in the patches, options, or compatible versions
    of the app between the old and new snapshot.
    """
    def normalize_app_data(app):
        normalized_patches = []
        for patch in app.get("patches", []):
            opts = patch.get("options") or []
            normalized_opts = sorted(
                [{"key": str(opt.get("key", "")), "description": str(opt.get("description", ""))} for opt in opts],
                key=lambda x: x["key"]
            )
            comp_vers = sorted(str(v) for v in patch.get("compatible_versions", []))
            normalized_patches.append({
                "name": str(patch.get("name", "")),
                "description": str(patch.get("description", "")),
                "use": bool(patch.get("use", True)),
                "options": normalized_opts,
                "compatible_versions": comp_vers
            })
        normalized_patches.sort(key=lambda x: x["name"])
        return {
            "app_name": str(app.get("app_name", "")),
            "patches": normalized_patches
        }

    return normalize_app_data(old_app) != normalize_app_data(new_app)

def patch_diff_details(old_patch, new_patch):
    """Return a list of human-readable change descriptions between old and new patch."""
    changes = []
    if old_patch.get("description") != new_patch.get("description"):
        changes.append("description updated")
    if old_patch.get("use") != new_patch.get("use"):
        old_use = old_patch.get("use", True)
        new_use = new_patch.get("use", True)
        changes.append("enabled" if new_use and not old_use else "disabled")
    old_opts = {o.get("key", ""): o.get("description", "") for o in old_patch.get("options", [])}
    new_opts = {o.get("key", ""): o.get("description", "") for o in new_patch.get("options", [])}
    if old_opts != new_opts:
        added_opts = [k for k in new_opts if k not in old_opts]
        removed_opts = [k for k in old_opts if k not in new_opts]
        changed_opts = [k for k in old_opts if k in new_opts and old_opts[k] != new_opts[k]]
        parts = []
        if added_opts:
            parts.append(f"+{len(added_opts)} option{'s' if len(added_opts) > 1 else ''}")
        if removed_opts:
            parts.append(f"-{len(removed_opts)} option{'s' if len(removed_opts) > 1 else ''}")
        if changed_opts:
            parts.append(f"~{len(changed_opts)} option{'s' if len(changed_opts) > 1 else ''}")
        if parts:
            changes.append("options: " + ", ".join(parts))
    old_cv = set(str(v) for v in old_patch.get("compatible_versions", []))
    new_cv = set(str(v) for v in new_patch.get("compatible_versions", []))
    if old_cv != new_cv:
        added_vers = new_cv - old_cv
        removed_vers = old_cv - new_cv
        parts = []
        if added_vers:
            parts.append(f"+{len(added_vers)} version{'s' if len(added_vers) > 1 else ''}")
        if removed_vers:
            parts.append(f"-{len(removed_vers)} version{'s' if len(removed_vers) > 1 else ''}")
        if parts:
            changes.append("versions: " + ", ".join(parts))
    return changes

def compute_patch_diff(old_app, new_app):
    """Compute which patches were added/removed between old and new app state."""
    old_patches = {p.get("name", ""): p for p in old_app.get("patches", [])}
    new_patches = {p.get("name", ""): p for p in new_app.get("patches", [])}
    
    old_names = set(old_patches.keys())
    new_names = set(new_patches.keys())
    
    added_names = sorted(new_names - old_names)
    removed_names = sorted(old_names - new_names)
    
    # Also detect modified patches (same name, different content)
    modified_names = sorted([
        n for n in (old_names & new_names)
        if old_patches[n] != new_patches[n]
    ])
    
    def enrich(names, source):
        return [{"name": n, "description": source.get(n, {}).get("description", "")} for n in names]
    
    return {
        "patches_added": enrich(added_names, new_patches),
        "patches_removed": enrich(removed_names, old_patches),
        "patches_modified": [
            {
                "name": n,
                "description": new_patches.get(n, {}).get("description", ""),
                "changes": patch_diff_details(old_patches[n], new_patches[n])
            }
            for n in modified_names
        ]
    }

def diff_snapshots():
    new_snapshot_path = os.path.join(RAW_DIR, "parsed_bundles.json")
    new_snapshot = load_json(new_snapshot_path, default={})
    old_snapshot = load_current_snapshot()

    now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    affected_bundles = []

    # Process each bundle:channel in the new snapshot
    for bundle_key, new_rec in new_snapshot.items():
        bundle_name = new_rec["bundle"]
        channel = new_rec["channel"]
        new_apps_list = new_rec.get("apps", [])

        if bundle_key not in old_snapshot:
            # Scenario B: New Bundle — include all its apps
            print(f"[+] Diff: Found new bundle {bundle_key}")
            apps = []
            for app in new_apps_list:
                apps.append({
                    "app_name": app["app_name"],
                    "package": app["package"],
                    "badge_type": "NEW APP"
                })
            affected_bundles.append({
                "bundle": bundle_name,
                "channel": channel,
                "badge_type": "NEW BUNDLE",
                "apps": apps
            })
        else:
            # Scenario C: Existing bundle — check fingerprint
            old_rec = old_snapshot[bundle_key]
            new_fp = new_rec.get("fingerprint")
            old_fp = old_rec.get("fingerprint")

            if new_fp != old_fp:
                old_app_map = {app["package"].lower().strip(): app for app in old_rec.get("apps", [])}
                new_app_map = {app["package"].lower().strip(): app for app in new_apps_list}

                changed_apps = []

                for pkg, app in new_app_map.items():
                    if pkg not in old_app_map:
                        print(f"[+] Diff: Found new app {app['app_name']} ({pkg}) in {bundle_key}")
                        changed_apps.append({
                            "app_name": app["app_name"],
                            "package": app["package"],
                            "badge_type": "NEW APP"
                        })
                    elif apps_are_different(old_app_map[pkg], app):
                        print(f"[~] Diff: Found updated app {app['app_name']} ({pkg}) in {bundle_key}")
                        patch_diff = compute_patch_diff(old_app_map[pkg], app)
                        changed_apps.append({
                            "app_name": app["app_name"],
                            "package": app["package"],
                            "badge_type": "UPDATED APP",
                            "patch_diff": patch_diff
                        })

                for pkg, app in old_app_map.items():
                    if pkg not in new_app_map:
                        print(f"[-] Diff: Found removed app {app['app_name']} ({pkg}) in {bundle_key}")
                        changed_apps.append({
                            "app_name": app["app_name"],
                            "package": app["package"],
                            "badge_type": "REMOVED APP"
                        })

                # Only emit the bundle if at least one app-level change exists
                if changed_apps:
                    old_fp_display = old_fp[:8] if old_fp else "None"
                    new_fp_display = new_fp[:8] if new_fp else "None"
                    print(f"[+] Diff: Bundle {bundle_key} fingerprint changed ({old_fp_display} -> {new_fp_display})")
                    affected_bundles.append({
                        "bundle": bundle_name,
                        "channel": channel,
                        "badge_type": "UPDATED",
                        "apps": changed_apps
                    })
                else:
                    print(f"[*] Diff: Bundle {bundle_key} fingerprint changed but no app-level changes. Skipping.")

    has_changes = len(affected_bundles) > 0

    # Update last_run.json with metadata
    last_run_data = load_last_run()
    last_run_data["has_changes"] = has_changes
    last_run_data["affected_bundles_count"] = len(affected_bundles)
    last_run_data["lastChecked"] = now_utc
    save_last_run(last_run_data)

    # Save diff result
    diff_data = {
        "affected_bundles": affected_bundles
    }
    save_json(os.path.join(RAW_DIR, "diff_result.json"), diff_data)

    if not has_changes:
        print("[*] No changes detected. Short-circuiting execution.")
        return False

    print(f"Diff complete. Found {len(affected_bundles)} affected bundles.")
    return True

if __name__ == "__main__":
    ensure_dirs()
    diff_snapshots()
