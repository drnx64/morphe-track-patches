import os
import json
import shutil
from datetime import datetime

# Define base paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
STATE_DIR = os.path.join(DATA_DIR, "state")
RAW_DIR = os.path.join(DATA_DIR, "raw")
OUTPUT_DIR = os.path.join(DATA_DIR, "output")
DOCS_DIR = BASE_DIR
DOCS_DATA_DIR = os.path.join(DOCS_DIR, "data")

# State files paths
CURRENT_SNAPSHOT_PATH = os.path.join(STATE_DIR, "current_snapshot.json")
PREVIOUS_SNAPSHOT_PATH = os.path.join(STATE_DIR, "previous_snapshot.json")
DAILY_BUFFER_PATH = os.path.join(STATE_DIR, "daily_buffer.json")
LAST_RUN_PATH = os.path.join(STATE_DIR, "last_run.json")

ROLLBACK_PATHS = [
    os.path.join(STATE_DIR, "rollback_1.json"),
    os.path.join(STATE_DIR, "rollback_2.json"),
    os.path.join(STATE_DIR, "rollback_3.json")
]

CHANGELOG_JSON_PATH = os.path.join(OUTPUT_DIR, "changelog.json")
CHANGELOG_MD_PATH = os.path.join(OUTPUT_DIR, "changelog.md")
LIVE_JSON_PATH = os.path.join(DOCS_DATA_DIR, "live.json")

def ensure_dirs():
    """Ensure all required directories exist."""
    for path in [STATE_DIR, RAW_DIR, OUTPUT_DIR, DOCS_DATA_DIR]:
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

def rotate_rollbacks():
    """Shift old snapshots forward: current -> r1 -> r2 -> r3."""
    ensure_dirs()
    
    # Check if current snapshot exists and is valid
    if os.path.exists(CURRENT_SNAPSHOT_PATH):
        # Shift r2 -> r3
        if os.path.exists(ROLLBACK_PATHS[1]):
            shutil.copy2(ROLLBACK_PATHS[1], ROLLBACK_PATHS[2])
        # Shift r1 -> r2
        if os.path.exists(ROLLBACK_PATHS[0]):
            shutil.copy2(ROLLBACK_PATHS[0], ROLLBACK_PATHS[1])
        # Shift current -> r1
        shutil.copy2(CURRENT_SNAPSHOT_PATH, ROLLBACK_PATHS[0])
        print("Rollback snapshots rotated successfully.")

def save_new_snapshot(snapshot_data):
    """
    Saves a new snapshot. Shuts current snapshot to previous, rotates rollbacks,
    and updates current snapshot.
    """
    ensure_dirs()
    
    # 1. If current snapshot exists, copy it to previous_snapshot.json
    if os.path.exists(CURRENT_SNAPSHOT_PATH):
        shutil.copy2(CURRENT_SNAPSHOT_PATH, PREVIOUS_SNAPSHOT_PATH)
        
    # 2. Rotate rollbacks
    rotate_rollbacks()
    
    # 3. Save new data as current_snapshot.json
    return save_json(CURRENT_SNAPSHOT_PATH, snapshot_data)

def load_current_snapshot():
    return load_json(CURRENT_SNAPSHOT_PATH, default={})

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

def save_live_json(live_data):
    return save_json(LIVE_JSON_PATH, live_data)

def load_live_json():
    return load_json(LIVE_JSON_PATH, default={})
