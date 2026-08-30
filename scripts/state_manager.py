import os
import json
import re

# Define base paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
STATE_DIR = os.path.join(DATA_DIR, "state")
RAW_DIR = os.path.join(DATA_DIR, "raw")
OUTPUT_DIR = os.path.join(DATA_DIR, "output")
ROOT_DIR = BASE_DIR
ROOT_DATA_DIR = os.path.join(ROOT_DIR, "data")

# State files paths
CURRENT_SNAPSHOT_PATH = os.path.join(STATE_DIR, "current_snapshot.json")
PREVIOUS_SNAPSHOT_PATH = os.path.join(STATE_DIR, "previous_snapshot.json")
DAILY_BUFFER_PATH = os.path.join(STATE_DIR, "daily_buffer.json")
LAST_RUN_PATH = os.path.join(STATE_DIR, "last_run.json")

CHANGELOG_JSON_PATH = os.path.join(OUTPUT_DIR, "changelog.json")
CHANGELOG_MD_PATH = os.path.join(OUTPUT_DIR, "changelog.md")

# Repo list files
CUSTOM_REPO_PATH = os.path.join(ROOT_DATA_DIR, "custom_repo.txt")
IGNORE_REPO_PATH = os.path.join(ROOT_DATA_DIR, "ignore_repo.txt")

# Split data files (kebab-case)
CORE_JSON_PATH = os.path.join(ROOT_DATA_DIR, "core.json")
BUNDLES_JSON_PATH = os.path.join(ROOT_DATA_DIR, "bundles.json")
BUNDLES_DIR = os.path.join(ROOT_DATA_DIR, "bundles")
CHANGES_JSON_PATH = os.path.join(ROOT_DATA_DIR, "changes.json")
STATS_JSON_PATH = os.path.join(ROOT_DATA_DIR, "stats.json")

def ensure_dirs():
    """Ensure all required directories exist."""
    for path in [STATE_DIR, RAW_DIR, OUTPUT_DIR, ROOT_DATA_DIR]:
        os.makedirs(path, exist_ok=True)

def load_json(filepath, default=None):
    """Safely load a JSON file, returning the default if it doesn't exist or is invalid."""
    if default is None:
        default = {}
    if not os.path.exists(filepath):
        return default
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading {filepath}: {e}. Returning default.")
        return default

def save_json(filepath, data):
    """Safely save data to a JSON file with pretty printing."""
    ensure_dirs()
    temp_path = filepath + ".tmp"
    try:
        with open(temp_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        if os.path.exists(filepath):
            os.remove(filepath)
        os.rename(temp_path, filepath)
        return True
    except Exception as e:
        print(f"Error saving to {filepath}: {e}")
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except:
                pass
        return False

def save_new_snapshot(snapshot_data):
    """
    Saves a new snapshot. Moves current snapshot to previous, then writes new data as current.
    """
    ensure_dirs()
    snapshot_data = _strip_icon_url(snapshot_data)

    # Move current snapshot to previous_snapshot.json (overwrites old previous)
    if os.path.exists(CURRENT_SNAPSHOT_PATH):
        os.replace(CURRENT_SNAPSHOT_PATH, PREVIOUS_SNAPSHOT_PATH)

    # Save new data as current_snapshot.json
    return save_json(CURRENT_SNAPSHOT_PATH, snapshot_data)

def load_current_snapshot():
    return load_json(CURRENT_SNAPSHOT_PATH, default={})

def rebuild_snapshot_from_bundles():
    """Rebuild snapshot from committed data/bundles/*.json files.

    Used when current_snapshot.json is missing (e.g. CI fresh checkout).
    Each bundle file already contains apps, version, and fingerprint fields
    needed for diff comparison.
    """
    import glob as glob_mod

    if not os.path.isdir(BUNDLES_DIR):
        print("[snapshot] No data/bundles/ directory found, starting with empty snapshot")
        return {}

    # Fast path: use _index.json to get the correct key for each file
    index = load_json(os.path.join(BUNDLES_DIR, "_index.json"), default={})

    # Build reverse map: filename -> key from index
    filename_to_key = {}
    for key in index:
        filename = key.replace(":", "_") + ".json"
        filename_to_key[filename] = key

    snapshot = {}
    bundle_files = sorted(glob_mod.glob(os.path.join(BUNDLES_DIR, "*.json")))

    for filepath in bundle_files:
        filename = os.path.basename(filepath)
        if filename == "_index.json":
            continue
        try:
            record = load_json(filepath, default=None)
            if not record:
                continue
            key = filename_to_key.get(filename)
            if not key:
                # Fallback: reconstruct from record fields
                bundle_name = record.get("bundle", filename.removesuffix(".json"))
                channel = record.get("channel", "stable")
                key = f"{bundle_name}:{channel}"
            # Strip icon_url to match snapshot format
            for app in record.get("apps", []):
                app.pop("icon_url", None)
            snapshot[key] = record
        except Exception as e:
            print(f"[snapshot] Error reading {filepath}: {e}")

    print(f"[snapshot] Rebuilt snapshot from {len(snapshot)} bundle files")
    return snapshot

def load_previous_snapshot():
    return load_json(PREVIOUS_SNAPSHOT_PATH, default={})

def load_daily_buffer():
    return load_json(DAILY_BUFFER_PATH, default={
        "date": "",
        "lastChecked": "",
        "scan_counter": 0,
        "affected_bundles": {}
    })

def save_daily_buffer(buffer_data):
    return save_json(DAILY_BUFFER_PATH, buffer_data)

def save_last_run(last_run_data):
    return save_json(LAST_RUN_PATH, last_run_data)

def load_last_run():
    return load_json(LAST_RUN_PATH, default={})

def save_core_json(data):
    return save_json(CORE_JSON_PATH, data)

def save_stats_json(data):
    return save_json(STATS_JSON_PATH, data)

def save_changes_json(data):
    return save_json(CHANGES_JSON_PATH, data)

def _strip_icon_url(data):
    """Remove icon_url from all app entries in bundle data."""
    for record in data.values():
        for app in record.get("apps", []):
            app.pop("icon_url", None)
    return data


def save_bundles_json(data):
    data = _strip_icon_url(dict(data))
    return save_json(BUNDLES_JSON_PATH, data)


def save_bundles_split(data):
    """Save bundles as individual files: data/bundles/_index.json + data/bundles/<key>.json"""
    data = _strip_icon_url(dict(data))
    os.makedirs(BUNDLES_DIR, exist_ok=True)

    index = {}
    for key, record in data.items():
        index[key] = {
            "bundle": record.get("bundle", ""),
            "channel": record.get("channel", ""),
            "version": record.get("version", ""),
            "repo_url": record.get("repo_url", ""),
            "patches_name": record.get("patches_name", ""),
            "release_tag": record.get("release_tag", ""),
            "release_date": record.get("release_date", ""),
            "app_count": len(record.get("apps", [])),
        }
        filename = key.replace(":", "_") + ".json"
        save_json(os.path.join(BUNDLES_DIR, filename), record)

    save_json(os.path.join(BUNDLES_DIR, "_index.json"), index)
    print(f"[bundles] Split {len(data)} bundles into {BUNDLES_DIR}")
    return True

def load_core_json():
    return load_json(CORE_JSON_PATH, default={})

def load_repo_list(filepath):
    """Load a repo list file (custom_repo.txt or ignore_repo.txt).

    Returns a list of (owner, repo, platform) tuples where platform is 'github' or 'gitlab'.
    Lines starting with '#' are ignored. Empty lines are ignored.
    Format: owner/repo or gl:owner/repo for GitLab.
    """
    repos = []
    if not os.path.exists(filepath):
        return repos
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                platform = "github"
                entry = line
                if line.startswith("gl:") or line.startswith("gitlab:"):
                    platform = "gitlab"
                    entry = line.split(":", 1)[1].strip()
                m = re.match(r"^([^/]+)/([^/#\s]+)", entry)
                if m:
                    repos.append((m.group(1).strip(), m.group(2).strip(), platform))
    except Exception as e:
        print(f"Error loading repo list from {filepath}: {e}")
    return repos

def save_repo_list(filepath, repos):
    """Save a list of (owner, repo, platform) tuples back to a repo list file.

    Lines starting with '#' are preserved. Existing content before the first entry is kept.
    """

    header_lines = []
    new_entries = []
    if os.path.exists(filepath):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                in_header = True
                for line in f:
                    stripped = line.strip()
                    if in_header and (not stripped or stripped.startswith("#")):
                        header_lines.append(line.rstrip("\n"))
                    else:
                        in_header = False
        except Exception:
            header_lines = []
    for owner, repo, platform in repos:
        if platform == "gitlab":
            new_entries.append(f"gl:{owner}/{repo}")
        else:
            new_entries.append(f"{owner}/{repo}")
    content = "\n".join(header_lines + new_entries) + "\n"
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
    except Exception as e:
        print(f"Error saving repo list to {filepath}: {e}")

def load_stats_json():
    return load_json(STATS_JSON_PATH, default={})

def load_changes_json():
    return load_json(CHANGES_JSON_PATH, default={})

def load_bundles_json():
    return load_json(BUNDLES_JSON_PATH, default={})


# ── Shared utilities ──────────────────────────────────────

COMMON_PACKAGES = {
    "com.google.android.youtube": "YouTube",
    "com.google.android.apps.youtube.music": "YouTube Music",
    "com.reddit.frontpage": "Reddit",
    "com.twitter.android": "Twitter",
    "com.instagram.android": "Instagram",
    "com.zhiliaoapp.musically": "TikTok",
    "com.spotify.music": "Spotify",
    "com.whatsapp": "WhatsApp",
    "org.telegram.messenger": "Telegram",
    "com.facebook.katana": "Facebook",
    "com.facebook.orca": "Messenger",
    "com.discord": "Discord",
    "com.netflix.mediaclient": "Netflix",
    "at.gv.oe.app": "OE App",
    "com.snapchat.android": "Snapchat",
    "com.pinsight.pinsight": "Pinsight",
    "com.google.android.apps.photos": "Google Photos",
    "com.google.android.apps.maps": "Google Maps",
    "com.google.android.gm": "Gmail",
}


def match_release_to_version(version, releases):
    """Match a version string to a GitHub release entry. Uses exact match first, then substring."""
    if not version:
        return None
    v_clean = version.lower().lstrip("v")
    for r in releases:
        tag_clean = r.get("tag", "").lower().lstrip("v")
        if tag_clean == v_clean:
            return r
    for r in releases:
        tag_clean = r.get("tag", "").lower().lstrip("v")
        if v_clean in tag_clean or tag_clean in v_clean:
            return r
    return None


def cleanup_orphaned_state():
    """Remove stale entries from icon_cache.json and name_cache.json that are no longer referenced by any bundle."""
    import json

    snapshot_path = os.path.join(RAW_DIR, "current_snapshot.json")
    snapshot = load_json(snapshot_path, default={})
    if not snapshot:
        return

    # Collect all current packages
    current_pkgs = set()
    for record in snapshot.values():
        for app in record.get("apps", []):
            pkg = app.get("package", "")
            if pkg:
                current_pkgs.add(pkg)

    # Prune icon_cache.json
    icon_cache_path = os.path.join(STATE_DIR, "icon_cache.json")
    icon_cache = load_json(icon_cache_path, default={})
    if icon_cache:
        pruned = {k: v for k, v in icon_cache.items() if any(pkg in k for pkg in current_pkgs) or not any(pkg in k for pkg in current_pkgs)}
        # Simpler: keep entries whose key contains a current package, or keep all if we can't determine
        # Actually icon keys are URLs, not packages — skip pruning icons for now
        pass

    # Prune name_cache.json
    name_cache_path = os.path.join(STATE_DIR, "name_cache.json")
    name_cache = load_json(name_cache_path, default={})
    if name_cache:
        pruned_names = {k: v for k, v in name_cache.items() if k in current_pkgs}
        if len(pruned_names) < len(name_cache):
            save_json(name_cache_path, pruned_names)
            print(f"[*] Cleaned name_cache: {len(name_cache)} -> {len(pruned_names)} entries")
