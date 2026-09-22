"""Track Git blob SHAs per file path to skip unchanged downloads.

The Git Trees API already returns a `sha` field for every blob.
We compare against stored SHAs to avoid downloading files that haven't changed.
"""
import os
from state_manager import STATE_DIR, load_json, save_json

FILE_SHAS_PATH = os.path.join(STATE_DIR, "file_shas.json")


def load_file_shas():
    return load_json(FILE_SHAS_PATH, default={})


def save_file_shas(shas):
    save_json(FILE_SHAS_PATH, shas)


def get_changed_files(tree_files, known_shas):
    """Return tree entries whose blob SHA differs from stored value (or is new)."""
    changed = []
    for item in tree_files:
        path = item.get("path", "")
        sha = item.get("sha", "")
        if not path or not sha:
            continue
        if known_shas.get(path) != sha:
            changed.append(item)
    return changed


def update_file_shas(changed_files, known_shas):
    """Merge new SHAs into the store for successfully downloaded files."""
    for item in changed_files:
        path = item.get("path", "")
        sha = item.get("sha", "")
        if path and sha:
            known_shas[path] = sha
    return known_shas


def prune_stale_shas(known_shas, current_paths):
    """Remove SHAs for files no longer in the tree."""
    current_set = set(current_paths)
    return {k: v for k, v in known_shas.items() if k in current_set}
