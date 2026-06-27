import os
import requests
import json
import time
from datetime import datetime
from dotenv import load_dotenv
from state_manager import load_json, save_json, ensure_dirs, RAW_DIR, STATE_DIR

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

def download_all_bundles():
    tree_json_path = os.path.join(RAW_DIR, "tree.json")
    tree_files = load_json(tree_json_path, default=[])
    
    if not tree_files:
        print("No files found in tree.json. Run fetch_patch_tree.py first.")
        return
        
    bundles = group_tree_files(tree_files)
    print(f"Discovered {len(bundles)} distinct bundles in tree.")
    
    # Clear raw bundles directory to ensure a clean state
    bundles_raw_dir = os.path.join(RAW_DIR, "bundles")
    if os.path.exists(bundles_raw_dir):
        import shutil
        shutil.rmtree(bundles_raw_dir, ignore_errors=True)
        
    # Track errors for last_run.json
    errors = []
    downloaded_count = 0
    
    for bundle_name, channels in bundles.items():
        for channel, paths in channels.items():
            bundle_path = paths.get("bundle_path")
            list_path = paths.get("list_path")
            
            # Skip if either is missing
            if not bundle_path or not list_path:
                err_msg = f"Incomplete bundle+channel pair. Missing bundle_path or list_path."
                print(f"[-] Skip {bundle_name}:{channel} - {err_msg}")
                errors.append({
                    "bundle": f"{bundle_name}:{channel}",
                    "error": err_msg
                })
                continue
                
            # Download patches-bundle.json
            print(f"[+] Fetching {bundle_name}:{channel} patches-bundle.json...")
            bundle_content = download_file_with_retry(bundle_path)
            if not bundle_content:
                err_msg = "Failed to download patches-bundle.json"
                print(f"[-] {bundle_name}:{channel} error: {err_msg}")
                errors.append({
                    "bundle": f"{bundle_name}:{channel}",
                    "error": err_msg
                })
                continue
                
            # Parse and validate as Morphe bundle
            try:
                bundle_json = json.loads(bundle_content)
            except Exception as e:
                err_msg = f"Failed to parse patches-bundle.json as JSON: {e}"
                print(f"[-] {bundle_name}:{channel} error: {err_msg}")
                errors.append({
                    "bundle": f"{bundle_name}:{channel}",
                    "error": err_msg
                })
                continue
                
            if not is_morphe_bundle(bundle_json):
                # Silent skip, as this is just a regular (non-Morphe) bundle in the repository
                continue
                
            # Create download dir now that we know it's a Morphe bundle
            dest_dir = os.path.join(RAW_DIR, "bundles", bundle_name, channel)
            os.makedirs(dest_dir, exist_ok=True)
            
            # Download patches-list.json
            print(f"[+] Downloading {bundle_name}:{channel} patches-list.json...")
            list_content = download_file_with_retry(list_path)
            if not list_content:
                err_msg = "Failed to download patches-list.json"
                print(f"[-] {bundle_name}:{channel} error: {err_msg}")
                errors.append({
                    "bundle": f"{bundle_name}:{channel}",
                    "error": err_msg
                })
                continue
                
            # Save files
            with open(os.path.join(dest_dir, "patches-bundle.json"), "w", encoding="utf-8") as f:
                f.write(bundle_content)
            with open(os.path.join(dest_dir, "patches-list.json"), "w", encoding="utf-8") as f:
                f.write(list_content)
                
            downloaded_count += 1
            
    print(f"Successfully downloaded {downloaded_count} bundle+channel pairs.")
    
    # Save partial run errors to last_run.json (or preserve it for fingerprint/diff steps)
    last_run_data = {
        "timestamp": datetime.now().isoformat(),
        "download_errors": errors,
        "downloaded_count": downloaded_count
    }
    save_json(os.path.join(STATE_DIR, "last_run.json"), last_run_data)

if __name__ == "__main__":
    ensure_dirs()
    download_all_bundles()
