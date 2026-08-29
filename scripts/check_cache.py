import os, json

BUNDLES_DIR = "data/bundles"
pkgs = set()
for f in os.listdir(BUNDLES_DIR):
    if f.endswith(".json") and not f.startswith("_"):
        try:
            data = json.load(open(os.path.join(BUNDLES_DIR, f), encoding="utf-8"))
            for app in data.get("apps", []):
                p = app.get("package", "").lower().strip()
                if p:
                    pkgs.add(p)
        except:
            pass
print(f"{len(pkgs)} unique packages in committed bundles")

# Check how many we already have cached
cache_path = "data/state/icon_cache.json"
cache = json.load(open(cache_path, encoding="utf-8")) if os.path.exists(cache_path) else {}
filled = sum(1 for v in cache.values() if isinstance(v, str) and v.startswith("data:"))
empty = sum(1 for v in cache.values() if isinstance(v, str) and v == "")
uncached = [p for p in pkgs if p not in cache]
print(f"Icon cache: {filled} filled, {empty} empty, {len(uncached)} not yet attempted")
