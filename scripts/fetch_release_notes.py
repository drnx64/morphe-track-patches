import os, re, json, sys, urllib.request, urllib.error, time

DOCS_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
live_path = os.path.join(DOCS_DATA_DIR, "live.json")

token = os.environ.get("GITHUB_TOKEN", "")

def fetch_release(owner, repo, retry=3):
    url = f"https://api.github.com/repos/{owner}/{repo}/releases/latest"
    for attempt in range(retry):
        req = urllib.request.Request(url)
        if token:
            req.add_header("Authorization", f"Bearer {token}")
        req.add_header("Accept", "application/vnd.github.v3+json")
        req.add_header("User-Agent", "MorpheTracker/1.0")
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return data.get("tag_name", ""), data.get("body", "")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None, None
            if e.code in (429, 403) and attempt < retry - 1:
                wait = (attempt + 1) * 5
                print(f"    Rate limited, waiting {wait}s...")
                time.sleep(wait)
                continue
            print(f"  HTTP {e.code} for {owner}/{repo}")
            return None, None
        except Exception as e:
            print(f"  Error for {owner}/{repo}: {e}")
            return None, None
    return None, None

with open(live_path, "r", encoding="utf-8") as f:
    live = json.load(f)

bundles = live.get("bundles", {})
print(f"Found {len(bundles)} bundle entries in live.json")

# Deduplicate by owner/repo
seen_repos = {}
for key, b in bundles.items():
    repo_url = b.get("repo_url", "")
    m = re.search(r"github\.com/([^/]+)/([^/]+)", repo_url) if repo_url else None
    if not m:
        continue
    owner_repo = f"{m.group(1)}/{m.group(2)}"
    if owner_repo not in seen_repos:
        seen_repos[owner_repo] = []
    seen_repos[owner_repo].append(key)

print(f"Found {len(seen_repos)} unique repos to fetch")

for owner_repo, bundle_keys in seen_repos.items():
    # Check if any bundle for this repo already has a description
    already = False
    for k in bundle_keys:
        if bundles[k].get("description", "").strip():
            already = True
            break
    if already:
        print(f"  SKIP {owner_repo} — already has description")
        continue

    owner, repo = owner_repo.split("/", 1)
    print(f"  Fetching {owner_repo} ({len(bundle_keys)} bundle(s))...")
    tag, body = fetch_release(owner, repo)
    if body:
        for k in bundle_keys:
            bundles[k]["description"] = body
        print(f"    -> Saved release {tag} ({len(body)} chars) for {len(bundle_keys)} bundle(s)")
    else:
        print(f"    -> No release body")
    time.sleep(0.5)

with open(live_path, "w", encoding="utf-8") as f:
    json.dump(live, f, indent=2, ensure_ascii=False)

filled = sum(1 for b in bundles.values() if b.get("description", "").strip())
print(f"\nDone. Updated live.json with {filled}/{len(bundles)} descriptions.")
