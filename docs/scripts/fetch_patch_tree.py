import os
import time
import urllib.error
import urllib.request
from state_manager import save_json, ensure_dirs, RAW_DIR
from http_utils import fetch_url


def fetch_bundle_tree():
    """
    Fetch the list of files in the Jman-Github/ReVanced-Patch-Bundles repository
    from the bundles branch using the git trees API.
    """
    url = "https://api.github.com/repos/Jman-Github/ReVanced-Patch-Bundles/git/trees/bundles?recursive=1"
    retries = 3
    for attempt in range(1, retries + 1):
        try:
            print(f"Fetching repository tree (attempt {attempt}/{retries})...")
            data = fetch_url(url, as_json=True, timeout=30)
            tree = data.get("tree", [])

            patch_bundles_files = []
            for item in tree:
                path = item.get("path", "")
                if path.startswith("patch-bundles/") and item.get("type") == "blob":
                    patch_bundles_files.append(item)

            print(f"Successfully retrieved tree. Found {len(patch_bundles_files)} files under patch-bundles/.")

            tree_json_path = os.path.join(RAW_DIR, "tree.json")
            save_json(tree_json_path, patch_bundles_files)
            return patch_bundles_files
        except Exception as e:
            print(f"Error fetching tree: {e}")

        if attempt < retries:
            time.sleep(2 ** attempt)

    print("Failed to fetch tree after 3 attempts.")
    raise RuntimeError("Failed to fetch repository tree after 3 attempts")


if __name__ == "__main__":
    ensure_dirs()
    fetch_bundle_tree()
