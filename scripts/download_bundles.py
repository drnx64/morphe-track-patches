import os
import shutil
import requests
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from state_manager import load_json, save_json, ensure_dirs, RAW_DIR, STATE_DIR, CUSTOM_REPO_PATH, IGNORE_REPO_PATH, load_repo_list, load_last_run, save_last_run
from config import SKIP_CACHE_TTL_DAYS

load_dotenv()

def group_tree_files(tree_files):
    """
    Groups the flat tree file list into {bundle_name: {channel: { 'bundle_path': ..., 'list_path': ... }}}
    Supports both conceptual subfolders (stable/patches-bundle.json) and actual flat naming (1fexd-stable-patches-bundle.json).
    """
    bundles = {}
    
    for item in tree_files:
        path = item.get("path", "")
        parts = path.split('/')
        if len(parts) < 3 or parts[0] != "patch-bundles":
            continue
            
        bundle_folder = parts[1]
        
        # Determine channel and file type
        channel = None
        file_type = None
        
        if len(parts) == 4:
            # Case A: patch-bundles/my-bundle/stable/patches-bundle.json
            ch = parts[2]
            filename = parts[3]
            if ch in ["stable", "dev"]:
                channel = ch
                if filename == "patches-bundle.json":
                    file_type = "bundle"
                elif filename == "patches-list.json":
                    file_type = "list"
        elif len(parts) == 3:
            # Case B: patch-bundles/1fexd-patch-bundles/1fexd-stable-patches-bundle.json
            filename = parts[2]
            if "-stable-patches-bundle.json" in filename:
                channel = "stable"
                file_type = "bundle"
            elif "-stable-patches-list.json" in filename:
                channel = "stable"
                file_type = "list"
            elif "-dev-patches-bundle.json" in filename:
                channel = "dev"
                file_type = "bundle"
            elif "-dev-patches-list.json" in filename:
                channel = "dev"
                file_type = "list"
                
        if channel and file_type:
            # Clean bundle folder name if it has -patch-bundles suffix (optional but keeps things neat)
            bundle_name = bundle_folder
            if bundle_name.endswith("-patch-bundles"):
                bundle_name = bundle_name[:-14]
            elif bundle_name.endswith("-patches"):
                bundle_name = bundle_name[:-8]
                
            if bundle_name not in bundles:
                bundles[bundle_name] = {}
            if channel not in bundles[bundle_name]:
                bundles[bundle_name][channel] = {}
                
            bundles[bundle_name][channel][f"{file_type}_path"] = path

    return bundles

def download_file_with_retry(path, max_retries=3):
    raw_url = f"https://raw.githubusercontent.com/Jman-Github/ReVanced-Patch-Bundles/bundles/{path}"
    headers = {
        "User-Agent": "MorphePatchTracker-Pipeline"
    }
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"token {token}"
        
    for attempt in range(1, max_retries + 1):
        try:
            response = requests.get(raw_url, headers=headers, timeout=20)
            if response.status_code == 200:
                return response.text
            else:
                print(f"Non-200 code fetching {path}: {response.status_code}")
        except Exception as e:
            print(f"Network error fetching {path}: {e}")
        
        if attempt < max_retries:
            time.sleep(2 ** attempt)
            
    return None

def is_morphe_bundle(bundle_json):
    download_url = bundle_json.get("download_url")

    if not isinstance(download_url, str):
        return False

    if not download_url.lower().endswith(".mpp"):
        return False

    path_parts = download_url.split("/")
    if len(path_parts) < 8:
        return False

    return True

def _load_skip_bundle_names():
    """Load custom and ignore repos and return a set of bundle names to skip.

    Each custom/ignore repo's owner name is used as a potential bundle name
    prefix to match against Jman's bundle names.
    """
    skip = set()
    for filepath in (CUSTOM_REPO_PATH, IGNORE_REPO_PATH):
        for owner, repo, _ in load_repo_list(filepath):
            skip.add(owner.lower().replace("_", "-"))
            skip.add(f"{owner.lower()}-{repo.lower().replace('_', '-')}")
    return skip


def _load_skip_cache():
    """Load skip cache from last_run.json's download_errors.

    Returns a dict mapping bundle_key -> {error, last_attempted}.
    Entries without last_attempted (legacy) are treated as stale (always retry).
    """
    last_run = load_last_run()
    errors = last_run.get("download_errors", [])
    cache = {}
    for entry in errors:
        key = entry.get("bundle", "")
        if key:
            cache[key] = {
                "error": entry.get("error", ""),
                "last_attempted": entry.get("last_attempted"),
            }
    return cache


def _is_cache_fresh(entry):
    """Check if a skip cache entry is still within the TTL window."""
    ts = entry.get("last_attempted")
    if not ts:
        return False
    try:
        last_attempted = datetime.fromisoformat(ts)
        if last_attempted.tzinfo is None:
            last_attempted = last_attempted.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - last_attempted) < timedelta(days=SKIP_CACHE_TTL_DAYS)
    except (ValueError, TypeError):
        return False


def download_all_bundles():
    tree_json_path = os.path.join(RAW_DIR, "tree.json")
    tree_files = load_json(tree_json_path, default=[])
    
    if not tree_files:
        print("No files found in tree.json. Run fetch_patch_tree.py first.")
        return
        
    bundles = group_tree_files(tree_files)
    print(f"Discovered {len(bundles)} distinct bundles in tree.")

    # Load skip list from custom/ignore repos to avoid downloading duplicates
    skip_bundles = _load_skip_bundle_names()
    if skip_bundles:
        print(f"Skipping {len(skip_bundles)} bundle names from custom/ignore repos")
        before = len(bundles)
        bundles = {k: v for k, v in bundles.items() if k.lower() not in skip_bundles}
        print(f"  Filtered from {before} to {len(bundles)} bundles (skipped {before - len(bundles)})")

    # Load skip cache — bundles previously skipped as incomplete or non-morphe
    skip_cache = _load_skip_cache()
    cached_skips = sum(1 for k in skip_cache if _is_cache_fresh(skip_cache[k]))
    if cached_skips:
        print(f"Skip cache: {cached_skips} bundles within TTL ({SKIP_CACHE_TTL_DAYS}d), will skip silently")
    
    # Download to a temp directory, then swap atomically.
    bundles_raw_dir = os.path.join(RAW_DIR, "bundles")
    temp_dir = bundles_raw_dir + "_downloading"
    
    # Clean up any leftover temp dir from a previous failed run
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir, ignore_errors=True)
        
    # Build work items: list of (bundle_key, bundle_path, list_path) to download
    work_items = []
    errors = []
    
    for bundle_name, channels in bundles.items():
        for channel, paths in channels.items():
            bundle_path = paths.get("bundle_path")
            list_path = paths.get("list_path")
            bundle_key = f"{bundle_name}:{channel}"
            
            if not bundle_path or not list_path:
                cached = skip_cache.get(bundle_key)
                if cached and _is_cache_fresh(cached):
                    continue
                err_msg = f"Incomplete bundle+channel pair. Missing bundle_path or list_path."
                print(f"[-] Skip {bundle_key} - {err_msg}")
                errors.append({
                    "bundle": bundle_key,
                    "error": err_msg,
                    "last_attempted": datetime.now(timezone.utc).isoformat(),
                })
                continue
                
            # Check skip cache for this bundle
            cached = skip_cache.get(bundle_key)
            if cached and _is_cache_fresh(cached):
                continue
                
            work_items.append((bundle_key, bundle_path, list_path))

    print(f"Downloading {len(work_items)} bundle+channel pairs with 15 workers...")

    def _download_one(item):
        """Download a single bundle+channel pair. Returns (bundle_key, result_dict)."""
        bundle_key, bundle_path, list_path = item
        bundle_name, channel = bundle_key.split(":", 1)
        
        # Download patches-bundle.json
        bundle_content = download_file_with_retry(bundle_path)
        if not bundle_content:
            return (bundle_key, {"error": "Failed to download patches-bundle.json"})
            
        # Parse and validate as Morphe bundle
        try:
            bundle_json = json.loads(bundle_content)
        except Exception as e:
            return (bundle_key, {"error": f"Failed to parse patches-bundle.json as JSON: {e}"})
            
        if not is_morphe_bundle(bundle_json):
            return (bundle_key, {"error": "Not a Morphe bundle"})
            
        # Download patches-list.json
        list_content = download_file_with_retry(list_path)
        if not list_content:
            return (bundle_key, {"error": "Failed to download patches-list.json"})
            
        return (bundle_key, {
            "bundle_content": bundle_content,
            "list_content": list_content,
            "bundle_name": bundle_name,
            "channel": channel,
        })

    downloaded_count = 0
    
    with ThreadPoolExecutor(max_workers=15) as executor:
        futures = {executor.submit(_download_one, item): item for item in work_items}
        for future in as_completed(futures):
            bundle_key, result = future.result()
            if "error" in result:
                print(f"[-] {bundle_key} error: {result['error']}")
                errors.append({
                    "bundle": bundle_key,
                    "error": result["error"],
                    "last_attempted": datetime.now(timezone.utc).isoformat(),
                })
            else:
                bundle_name = result["bundle_name"]
                channel = result["channel"]
                dest_dir = os.path.join(temp_dir, bundle_name, channel)
                os.makedirs(dest_dir, exist_ok=True)
                with open(os.path.join(dest_dir, "patches-bundle.json"), "w", encoding="utf-8") as f:
                    f.write(result["bundle_content"])
                with open(os.path.join(dest_dir, "patches-list.json"), "w", encoding="utf-8") as f:
                    f.write(result["list_content"])
                downloaded_count += 1
            
    print(f"Successfully downloaded {downloaded_count} bundle+channel pairs.")
    
    # Atomic swap: remove old dir, rename temp to final
    if os.path.exists(bundles_raw_dir):
        for attempt in range(3):
            try:
                shutil.rmtree(bundles_raw_dir)
                break
            except PermissionError:
                if attempt < 2:
                    print(f"[warn] rmtree locked, retrying in 1s (attempt {attempt + 1}/3)")
                    time.sleep(1)
                else:
                    print("[warn] rmtree failed after 3 retries, using ignore_errors")
                    shutil.rmtree(bundles_raw_dir, ignore_errors=True)

    if os.path.exists(bundles_raw_dir):
        shutil.move(temp_dir, bundles_raw_dir)
    elif os.path.exists(temp_dir):
        os.rename(temp_dir, bundles_raw_dir)
    
    # Merge download results into last_run.json
    last_run_data = load_last_run()
    last_run_data["download_errors"] = errors
    last_run_data["downloaded_count"] = downloaded_count
    save_last_run(last_run_data)

if __name__ == "__main__":
    ensure_dirs()
    download_all_bundles()
