import os
import sys
from datetime import datetime, timezone

# Import modules from scripts directory
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from state_manager import load_daily_buffer, ensure_dirs, load_last_run
from fetch_patch_tree import fetch_bundle_tree
from download_bundles import download_all_bundles
from parse_bundles import parse_all_bundles
from fingerprint_engine import generate_bundle_fingerprints
from diff_engine import diff_snapshots
from merge_daily_buffer import update_daily_buffer_run, write_data_files
from update_release_cache import update_release_cache

def run():
    print("=== STARTING MORPHE PATCH TRACKER PIPELINE ===")
    print(f"Current local time: {datetime.now().isoformat()}")
    
    # Ensure all dirs are created
    ensure_dirs()
    
    # Step 1 & 2: Fetch tree
    print("\n--- STEP 1 & 2: Fetching patch tree directory ---")
    fetch_bundle_tree()
    
    # Step 3: Download bundles
    print("\n--- STEP 3: Downloading bundles ---")
    download_all_bundles()
    
    # Step 4: Parse bundles
    print("\n--- STEP 4: Parsing bundles and validating MPP compatibility ---")
    parse_all_bundles()
    
    # Step 5: Fingerprint engine
    print("\n--- STEP 5: Generating fingerprints ---")
    generate_bundle_fingerprints()
    
    # Step 6: Diff engine (compare with previous snapshot)
    print("\n--- STEP 6: Diffing snapshots ---")
    has_changes = diff_snapshots()
    
    # Check if a day rollover is pending
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    buffer_data = load_daily_buffer()
    is_rollover = buffer_data.get("date") and buffer_data["date"] != today_str
    
    # Step 7: Update release notes cache (always run to refresh stale cache)
    print("\n--- STEP 7: Updating release notes cache ---")
    update_release_cache()
    
    # Step 8: Always sync data files for frontend (reads current_snapshot.json)
    print("\n--- STEP 8: Syncing data files ---")
    write_data_files()
    
    # Step 9 & 10: Update daily buffer and store state
    # Silent run rule: if no changes and no rollover, exit silently before updating state/buffer/site
    if not has_changes and not is_rollover:
        print("\n=== PIPELINE FINISHED SILENTLY (No changes and no day rollover) ===")
        run_silent()
        return
        
    print("\n--- STEP 9 & 10: Updating daily buffer and finalization check ---")
    update_daily_buffer_run()
    
    # Step 10: Regenerate site files
    print("\n--- STEP 10: Regenerating static site ---")
    from generate_site import generate_static_files
    generate_static_files()
    
    # Step 11: Always generate RSS feed
    print("\n--- STEP 11: Generating RSS feed ---")
    from generate_site import generate_rss_feed
    generate_rss_feed()

    print("\n=== PIPELINE RUN COMPLETE ===")


def run_silent():
    """Run RSS generation only, for silent pipeline runs with no data changes."""
    from generate_site import generate_rss_feed
    generate_rss_feed()

    print("\n=== SILENT RUN COMPLETE (RSS feed refreshed) ===")


if __name__ == "__main__":
    run()
