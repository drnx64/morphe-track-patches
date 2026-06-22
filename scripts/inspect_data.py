import json

with open("data/live.json", "r", encoding="utf-8") as f:
    data = json.load(f)

bundles = data.get("bundles", {})

# Find a bundle+app that actually has patches
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
