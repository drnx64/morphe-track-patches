import os
import hashlib
import json
from state_manager import load_json, save_json, ensure_dirs, RAW_DIR

def compute_fingerprint(bundle_name, apps, channel):
    """
    Computes fingerprint = SHA256(bundle_name + canonical_hash(apps) + channel)
    If apps is a list of strings (packages), hashes them.
    If apps is a list of dicts (parsed apps), hashes their canonical structure.
    """
    if not apps:
        hash_input = f"{bundle_name}{channel}"
    elif isinstance(apps[0], str):
        # Fallback compatibility: list of package strings
        sorted_apps = sorted([pkg.lower().strip() for pkg in apps])
        hash_input = f"{bundle_name}{''.join(sorted_apps)}{channel}"
    else:
        # Full app dict structure
        canonical_apps = []
        for app in apps:
            pkg = app.get("package", "").lower().strip()
            app_name = app.get("app_name", "")

            # Sort and canonicalize patches
            canonical_patches = []
            for patch in app.get("patches", []):
                opts = sorted(
                    [{"key": str(o.get("key", "")), "description": str(o.get("description", ""))} for o in patch.get("options", [])],
                    key=lambda x: x["key"]
                )
                comp_vers = sorted(str(v) for v in patch.get("compatible_versions", []))
                canonical_patches.append({
                    "name": str(patch.get("name", "")),
                    "description": str(patch.get("description", "")),
                    "use": bool(patch.get("use", True)),
                    "options": opts,
                    "compatible_versions": comp_vers
                })
            canonical_patches.sort(key=lambda x: x["name"])

            canonical_apps.append({
                "package": pkg,
                "app_name": app_name,
                "patches": canonical_patches
            })

        canonical_apps.sort(key=lambda x: x["package"])

        hash_input = json.dumps({
            "bundle_name": bundle_name,
            "channel": channel,
            "apps": canonical_apps
        }, sort_keys=True)

    sha256 = hashlib.sha256()
    sha256.update(hash_input.encode('utf-8'))
    return sha256.hexdigest()

def generate_bundle_fingerprints():
    parsed_bundles_path = os.path.join(RAW_DIR, "parsed_bundles.json")
    parsed_bundles = load_json(parsed_bundles_path, default={})
    
    if not parsed_bundles:
        print("No parsed bundles found to fingerprint. Run parse_bundles.py first.")
        return
        
    print(f"Generating fingerprints for {len(parsed_bundles)} bundles...")
    for key, record in parsed_bundles.items():
        bundle_name = record["bundle"]
        channel = record["channel"]
        apps = record.get("apps", [])
        
        fingerprint = compute_fingerprint(bundle_name, apps, channel)
        record["fingerprint"] = fingerprint
        print(f" - {key}: {fingerprint[:10]}...")
        
    save_json(parsed_bundles_path, parsed_bundles)
    print("Fingerprints generated and stored in parsed_bundles.json.")

if __name__ == "__main__":
    ensure_dirs()
    generate_bundle_fingerprints()
