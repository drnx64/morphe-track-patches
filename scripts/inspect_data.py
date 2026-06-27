import json
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from state_manager import DOCS_DATA_DIR

bundles_path = os.path.join(DOCS_DATA_DIR, "bundles.json")
with open(bundles_path, "r", encoding="utf-8") as f:
    bundles = json.load(f)

for key, b in bundles.items():
    for app in b.get("apps", []):
        patches = app.get("patches", [])
        if patches:
            print(f"=== Found patches in bundle '{key}', app '{app.get('app_name')}' ===")
            print(f"  Patches count: {len(patches)}")
            p = patches[0]
            print(f"  Patch[0] keys: {list(p.keys())}")
            print(f"  Patch name: {p.get('name')}")
            print(f"  Description: {str(p.get('description', ''))[:80]}")
            print(f"  Use: {p.get('use')}")
            print(f"  compatible_versions: {p.get('compatible_versions', [])}")
            opts = p.get("options", [])
            print(f"  options count: {len(opts)}")
            if opts:
                print(f"  Option[0] keys: {list(opts[0].keys())}")
                print(f"  Option[0]: {opts[0]}")
            print()
            break
    else:
        continue
    break
