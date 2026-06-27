import os, re, json, sys, time, urllib.request, urllib.error, urllib.parse, html as html_mod
from dotenv import load_dotenv
from state_manager import load_json, save_json, ensure_dirs, STATE_DIR, RAW_DIR

load_dotenv()

RELEASE_CACHE_PATH = os.path.join(STATE_DIR, "release_cache.json")
CACHE_TTL_HOURS = 1


def fetch_github_releases(owner, repo, retry=3):
    token = os.environ.get("GITHUB_TOKEN", "")
    url = f"https://api.github.com/repos/{owner}/{repo}/releases?per_page=15"
    for attempt in range(retry):
        req = urllib.request.Request(url)
        if token:
            req.add_header("Authorization", f"Bearer {token}")
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
                    date_released = r.get("published_at", "")
                    if tag:
                        releases.append({"tag": tag, "body": body, "prerelease": prerelease, "dateReleased": date_released})
                return releases
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return []
            if e.code in (429, 403) and attempt < retry - 1:
                wait = (attempt + 1) * 5
                print(f"    Rate limited, waiting {wait}s...")
                time.sleep(wait)
                continue
            print(f"    HTTP {e.code} for GitHub {owner}/{repo}")
            return []
        except Exception as e:
            print(f"    Error for GitHub {owner}/{repo}: {e}")
            return []
    return []


def fetch_gitlab_releases(owner, repo, retry=3):
    token = os.environ.get("GITLAB_TOKEN", "")
    encoded_path = urllib.parse.quote(f"{owner}/{repo}", safe="")
    url = f"https://gitlab.com/api/v4/projects/{encoded_path}/releases?per_page=15"
    for attempt in range(retry):
        req = urllib.request.Request(url)
        if token:
            req.add_header("Authorization", f"Bearer {token}")
        req.add_header("User-Agent", "MorpheTracker/1.0")
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                releases = []
                for r in data:
                    tag = r.get("tag_name", "")
                    description = r.get("description", "") or ""
                    if r.get("description_html"):
                        description = html_mod.unescape(re.sub(r'<[^>]+>', '', r["description_html"]))
                    date_released = r.get("released_at") or r.get("created_at", "")
                    if tag:
                        releases.append({"tag": tag, "body": description, "prerelease": False, "dateReleased": date_released})
                return releases
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return []
            if e.code in (429, 403) and attempt < retry - 1:
                wait = (attempt + 1) * 5
                print(f"    Rate limited, waiting {wait}s...")
                time.sleep(wait)
                continue
            print(f"    HTTP {e.code} for GitLab {owner}/{repo}")
            return []
        except Exception as e:
            print(f"    Error for GitLab {owner}/{repo}: {e}")
            return []
    return []


def match_release_to_version(version, releases):
    if not version:
        return None
    v_clean = version.lower().lstrip("v")
    for r in releases:
        tag_clean = r["tag"].lower().lstrip("v")
        if tag_clean == v_clean:
            return r
    for r in releases:
        tag_clean = r["tag"].lower().lstrip("v")
        if v_clean in tag_clean or tag_clean in v_clean:
            return r
    return None


def _extract_repos_from_parsed_bundles(parsed_bundles):
    repos = {}
    for bundle_key, bundle_data in parsed_bundles.items():
        repo_url = bundle_data.get("repo_url", "")
        if not repo_url:
            continue
        repos.setdefault(repo_url, []).append((bundle_key, bundle_data.get("version", "")))
    return repos


def _is_cache_stale(repo_cache):
    if not repo_cache or "fetched_at" not in repo_cache:
        return True
    try:
        from datetime import datetime, timezone
        fetched = datetime.fromisoformat(repo_cache["fetched_at"])
        age = datetime.now(timezone.utc) - fetched
        return age.total_seconds() > CACHE_TTL_HOURS * 3600
    except Exception:
        return True


def update_release_cache():
    ensure_dirs()
    parsed_path = os.path.join(RAW_DIR, "parsed_bundles.json")
    parsed_bundles = load_json(parsed_path, default={})
    if not parsed_bundles:
        print("No parsed bundles found. Run parse_bundles.py first.")
        return

    cache = load_json(RELEASE_CACHE_PATH, default={})
    repos = _extract_repos_from_parsed_bundles(parsed_bundles)
    print(f"Found {len(repos)} unique repo URLs across {len(parsed_bundles)} bundles")

    for repo_url, bundle_versions in repos.items():
        repo_cache = cache.get(repo_url, {})
        if not _is_cache_stale(repo_cache):
            print(f"  SKIP {repo_url} — cache fresh ({len(repo_cache.get('releases', []))} releases)")
            continue

        github_match = re.search(r"github\.com/([^/]+)/([^/]+)", repo_url)
        gitlab_match = re.search(r"gitlab\.com/([^/]+)/([^/]+)", repo_url)
        releases = []
        if github_match:
            owner = github_match.group(1)
            repo_name = github_match.group(2)
            print(f"  Fetching GitHub releases for {owner}/{repo_name}...")
            releases = fetch_github_releases(owner, repo_name)
        elif gitlab_match:
            owner = gitlab_match.group(1)
            repo_name = gitlab_match.group(2)
            print(f"  Fetching GitLab releases for {owner}/{repo_name}...")
            releases = fetch_gitlab_releases(owner, repo_name)
        else:
            print(f"  SKIP {repo_url} — unsupported platform")
            continue

        from datetime import datetime, timezone
        cache[repo_url] = {
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "releases": releases
        }
        print(f"    -> Cached {len(releases)} releases")
        time.sleep(0.5)

    save_json(RELEASE_CACHE_PATH, cache)
    print(f"\nRelease cache saved with {len(cache)} repos.")
    return cache


if __name__ == "__main__":
    ensure_dirs()
    update_release_cache()
