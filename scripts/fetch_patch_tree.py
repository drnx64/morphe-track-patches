import os
import sys
import requests
import time
from dotenv import load_dotenv
from state_manager import save_json, ensure_dirs, RAW_DIR

load_dotenv()

def fetch_bundle_tree():
    """
    Fetch the list of files in the Jman-Github/ReVanced-Patch-Bundles repository
    from the bundles branch using the git trees API.
    """
    url = "https://api.github.com/repos/Jman-Github/ReVanced-Patch-Bundles/git/trees/bundles?recursive=1"
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "MorphePatchTracker-Pipeline"
    }
    
    # Use GITHUB_TOKEN if available in environment (e.g. inside Actions runner) to avoid rate limiting
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"token {token}"
        
    retries = 3
    for attempt in range(1, retries + 1):
        try:
            print(f"Fetching repository tree (attempt {attempt}/{retries})...")
            response = requests.get(url, headers=headers, timeout=30)
            if response.status_code == 200:
                data = response.json()
                tree = data.get("tree", [])
                
                patch_bundles_files = []
                for item in tree:
                    path = item.get("path", "")
                    if path.startswith("patch-bundles/") and item.get("type") == "blob":
                        patch_bundles_files.append(item)
                        
                print(f"Successfully retrieved tree. Found {len(patch_bundles_files)} files under patch-bundles/.")
                
                # Save the tree output to data/raw/tree.json
                tree_json_path = os.path.join(RAW_DIR, "tree.json")
                save_json(tree_json_path, patch_bundles_files)
                return patch_bundles_files
            else:
                print(f"Error response from GitHub API: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"Network error or timeout: {e}")
            
        if attempt < retries:
            time.sleep(2 ** attempt)
            
    print("Failed to fetch tree after 3 attempts.")
    sys.exit(1)

if __name__ == "__main__":
    ensure_dirs()
    fetch_bundle_tree()
