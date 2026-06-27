import os, re, json, sys, urllib.request, urllib.error, urllib.parse, html, time
from dotenv import load_dotenv
load_dotenv()

DOCS_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
live_path = os.path.join(DOCS_DATA_DIR, "live.json")

github_token = os.environ.get("GITHUB_TOKEN", "")
gitlab_token = os.environ.get("GITLAB_TOKEN", "")


def fetch_github_releases(owner, repo, retry=3):
    url = f"https://api.github.com/repos/{owner}/{repo}/releases?per_page=15"
    for attempt in range(retry):
        req = urllib.request.Request(url)
        if github_token:
            req.add_header("Authorization", f"Bearer {github_token}")
        req.add_header("Accept", "application/vnd.github.v3+json")
        req.add_header("User-Agent", "MorpheTracker/1.0")
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                releases = []
                for r in data:
                    tag = r.get("tag_name", "")
                    body = r.get("body", "")
                    prerelease = r.get("prerelease", False)
                    if tag:
                        releases.append({"tag": tag, "body": body, "prerelease": prerelease})
                return releases
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return []
            if e.code in (429, 403) and attempt < retry - 1:
                wait = (attempt + 1) * 5
                print(f"    Rate limited, waiting {wait}s...")
                time.sleep(wait)
                continue
            print(f"  HTTP {e.code} for GitHub {owner}/{repo}")
            return []
        except Exception as e:
            print(f"  Error for GitHub {owner}/{repo}: {e}")
            return []
    return []


def fetch_gitlab_releases(owner, repo, retry=3):
    encoded_path = urllib.parse.quote(f"{owner}/{repo}", safe="")
    url = f"https://gitlab.com/api/v4/projects/{encoded_path}/releases?per_page=15"
    for attempt in range(retry):
        req = urllib.request.Request(url)
        if gitlab_token:
            req.add_header("Authorization", f"Bearer {gitlab_token}")
        req.add_header("User-Agent", "MorpheTracker/1.0")
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                releases = []
                for r in data:
                    tag = r.get("tag_name", "")
                    description = r.get("description", "") or ""
                    if r.get("description_html"):
                        description = html.unescape(re.sub(r'<[^>]+>', '', r["description_html"]))
                    if tag:
                        releases.append({"tag": tag, "body": description, "prerelease": False})
                return releases
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return []
            if e.code in (429, 403) and attempt < retry - 1:
                wait = (attempt + 1) * 5
                print(f"    Rate limited, waiting {wait}s...")
                time.sleep(wait)
                continue
            print(f"  HTTP {e.code} for GitLab {owner}/{repo}")
            return []
        except Exception as e:
            print(f"  Error for GitLab {owner}/{repo}: {e}")
            return []
    return []


def match_release_to_version(version, releases):
    if not version:
        return None
    v_clean = version.lower().lstrip("v")
    # First pass: exact match
    for r in releases:
        tag_clean = r["tag"].lower().lstrip("v")
        if tag_clean == v_clean:
            return r
    # Second pass: substring match (version contained in tag, or vice versa)
    for r in releases:
        tag_clean = r["tag"].lower().lstrip("v")
        if v_clean in tag_clean or tag_clean in v_clean:
            return r
    return None


with open(live_path, "r", encoding="utf-8") as f:
    live = json.load(f)

bundles = live.get("bundles", {})
print(f"Found {len(bundles)} bundle entries in live.json")

# Group bundles by repo URL (process all, even if description exists)
repos = {}
for key, b in bundles.items():
    repo_url = b.get("repo_url", "")
    if not repo_url:
        continue
    if repo_url not in repos:
        repos[repo_url] = []
    repos[repo_url].append(key)

print(f"Found {len(repos)} unique repos with bundles needing descriptions")

for repo_url, bundle_keys in repos.items():
    m = re.search(r"github\.com/([^/]+)/([^/]+)", repo_url)
    if m:
        owner, repo_name = m.group(1), m.group(2)
        print(f"  Fetching GitHub releases for {owner}/{repo_name} ({len(bundle_keys)} bundle(s))...")
        releases = fetch_github_releases(owner, repo_name)
    else:
        m = re.search(r"gitlab\.com/([^/]+)/([^/]+)", repo_url)
        if m:
            owner, repo_name = m.group(1), m.group(2)
            print(f"  Fetching GitLab releases for {owner}/{repo_name} ({len(bundle_keys)} bundle(s))...")
            releases = fetch_gitlab_releases(owner, repo_name)
        else:
            print(f"  SKIP {repo_url} — unsupported platform")
            continue

    if not releases:
        print(f"    -> No releases found")
        continue

    for key in bundle_keys:
        b = bundles[key]
        version = b.get("version", "")
        old_desc = b.get("description", "")
        matched = match_release_to_version(version, releases)
        if matched and matched["body"]:
            if matched["body"] != old_desc:
                b["description"] = matched["body"]
                print(f"    -> {key} v{version} matched '{matched['tag']}' — UPDATED ({len(matched['body'])} chars)")
            else:
                print(f"    -> {key} v{version} matched '{matched['tag']}' — unchanged")
        else:
            # Fallback: latest non-prerelease
            latest = None
            for r in releases:
                if not r["prerelease"]:
                    latest = r
                    break
            if not latest and releases:
                latest = releases[0]
            if latest and latest["body"]:
                if latest["body"] != old_desc:
                    b["description"] = latest["body"]
                    print(f"    -> {key} v{version} no tag match, using latest '{latest['tag']}' — UPDATED")
                else:
                    print(f"    -> {key} v{version} no tag match, using latest '{latest['tag']}' — unchanged")

    time.sleep(0.5)

with open(live_path, "w", encoding="utf-8") as f:
    json.dump(live, f, indent=2, ensure_ascii=False)

filled = sum(1 for b in bundles.values() if b.get("description", "").strip())
print(f"\nDone. Updated live.json with {filled}/{len(bundles)} descriptions.")
