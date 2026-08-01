"""Simulate a diff to verify summary generation works."""
import os
import sys
import json
import shutil

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "scripts"))

from state_manager import load_current_snapshot, save_json, RAW_DIR, CURRENT_SNAPSHOT_PATH
from diff_engine import diff_snapshots

# Backup current parsed_bundles.json
parsed_path = os.path.join(RAW_DIR, "parsed_bundles.json")
backup_path = parsed_path + ".bak"
if os.path.exists(parsed_path):
    shutil.copy2(parsed_path, backup_path)
    print(f"Backed up {parsed_path}")

# Copy current snapshot to parsed_bundles (this IS the latest parsed data)
shutil.copy2(CURRENT_SNAPSHOT_PATH, parsed_path)
print(f"Copied current snapshot to {parsed_path}")

# Now load and modify one bundle's data to simulate a change
with open(parsed_path, "r", encoding="utf-8") as f:
    snap = json.load(f)

# Find a bundle with apps that has patches
target = None
for key, b in snap.items():
    apps = b.get("apps", [])
    if apps and apps[0].get("patches"):
        target = key
        break

if target:
    print(f"\nModifying {target} to simulate an update...")
    b = snap[target]
    # Change fingerprint
    old_fp = b.get("fingerprint", "")
    b["fingerprint"] = "SIMULATED_CHANGE_" + old_fp[:8]

    # Modify first app's first patch description to trigger a diff
    apps = b.get("apps", [])
    if apps and apps[0].get("patches"):
        patch = apps[0]["patches"][0]
        old_desc = patch.get("description", "")
        patch["description"] = old_desc + " [UPDATED: now supports newer versions]"
        # Also add a new compatible version
        vers = patch.get("compatible_versions", [])
        if vers:
            patch["compatible_versions"] = vers + ["999.99.99"]
        print(f"  Modified patch: {patch['name']}")
        print(f"  Old desc: {old_desc[:50]}...")
        print(f"  New desc: {patch['description'][:50]}...")

    # Save modified snapshot
    with open(parsed_path, "w", encoding="utf-8") as f:
        json.dump(snap, f, indent=2, ensure_ascii=False)
    print("\nSaved modified parsed_bundles.json")
else:
    print("No suitable bundle found with patches")

# Run diff engine
print("\n=== Running diff_snapshots() ===")
result = diff_snapshots()
print(f"Diff result: has_changes={result}")

# Check diff_result.json for summaries
diff_path = os.path.join(RAW_DIR, "diff_result.json")
if os.path.exists(diff_path):
    with open(diff_path, "r", encoding="utf-8") as f:
        diff = json.load(f)
    bundles = diff.get("affected_bundles", [])
    print(f"\nAffected bundles: {len(bundles)}")
    for b in bundles:
        print(f"\n  Bundle: {b['bundle']} ({b['badge_type']})")
        for a in b.get("apps", []):
            has_s = "summary" in a
            s = a.get("summary", "")
            print(f"    {a['app_name']}: badge={a['badge_type']}")
            print(f"      summary={has_s}")
            if has_s:
                print(f"      -> {s[:120]}")
            if "patch_diff" in a:
                pd = a["patch_diff"]
                for mod in pd.get("patches_modified", []):
                    print(f"      changes: {mod.get('changes', [])}")

# Restore backup
if os.path.exists(backup_path):
    shutil.move(backup_path, parsed_path)
    print(f"\nRestored original {parsed_path}")

print("\n=== TEST COMPLETE ===")
