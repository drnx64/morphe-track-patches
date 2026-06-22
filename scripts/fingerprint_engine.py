import os
import hashlib
import json
from state_manager import load_json, save_json, ensure_dirs, RAW_DIR

def compute_fingerprint(bundle_name, app_packages, channel):
    """
    Computes fingerprint = SHA256(bundle_name + sorted(app_packages) + channel)
    """
    sorted_apps = sorted([pkg.lower().strip() for pkg in app_packages])
    hash_input = f"{bundle_name}{''.join(sorted_apps)}{channel}"
    
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
        app_packages = [app["package"] for app in record.get("apps", [])]
        
        fingerprint = compute_fingerprint(bundle_name, app_packages, channel)
        record["fingerprint"] = fingerprint
        print(f" - {key}: {fingerprint[:10]}...")
        
    save_json(parsed_bundles_path, parsed_bundles)
    print("Fingerprints generated and stored in parsed_bundles.json.")

if __name__ == "__main__":
    ensure_dirs()
    generate_bundle_fingerprints()
