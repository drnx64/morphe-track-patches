import os
import sys
import traceback
from datetime import datetime, timezone

# Import modules from scripts directory
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from log import log
from state_manager import load_daily_buffer, ensure_dirs, load_last_run, save_last_run, save_json, load_json, save_new_snapshot, STATE_DIR, RAW_DIR
from fetch_patch_tree import fetch_bundle_tree
from download_bundles import download_all_bundles
from fetch_external_repos import fetch_external_repos
from parse_bundles import parse_all_bundles
from fetch_patches_names import fetch_patches_names
from fingerprint_engine import generate_bundle_fingerprints
from diff_engine import diff_snapshots
from merge_daily_buffer import update_daily_buffer_run, write_data_files
from update_release_cache import update_release_cache

def run():
    start_time = datetime.now()
    log.info("=== STARTING MORPHE PATCH TRACKER PIPELINE ===")
    log.info(f"Current local time: {start_time.isoformat()}")

    try:
        # Ensure all dirs are created
        ensure_dirs()

        # Step 1 & 2: Fetch tree
        log.info("STEP 1 & 2: Fetching patch tree directory")
        fetch_bundle_tree()

        # Step 3: Download bundles
        log.info("STEP 3: Downloading bundles")
        download_all_bundles()

        # Step 3b: Fetch external repos from repos.txt that aren't yet in Jman
        log.info("STEP 3b: Fetching external repos from morphe-archive")
        fetch_external_repos()

        # Step 4: Parse bundles
        log.info("STEP 4: Parsing bundles and validating MPP compatibility")
        parse_all_bundles()

        # Step 4b: Fetch patches names from build.gradle.kts (cached monthly)
        log.info("STEP 4b: Fetching patches names from build.gradle.kts")
        fetch_patches_names()

        # Step 5: Fingerprint engine
        log.info("STEP 5: Generating fingerprints")
        generate_bundle_fingerprints()

        # Step 6: Diff engine (compare with previous snapshot)
        log.info("STEP 6: Diffing snapshots")
        has_changes = diff_snapshots()

        # Check if a day rollover is pending
        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        buffer_data = load_daily_buffer()
        is_rollover = buffer_data.get("date") and buffer_data["date"] != today_str

        # Step 7: Update release notes cache (always run to refresh stale cache)
        log.info("STEP 7: Updating release notes cache")
        update_release_cache()

        # Step 8 & 9: Update daily buffer and store state
        # Silent run rule: if no changes and no rollover, sync data files and exit silently
        if not has_changes and not is_rollover:
            log.info("STEP 8: Syncing data files (silent run)")
            write_data_files(has_changes=False)
            # Save snapshot so next run compares against current state
            new_snapshot_path = os.path.join(RAW_DIR, "parsed_bundles.json")
            new_snapshot = load_json(new_snapshot_path, default={})
            if new_snapshot:
                save_new_snapshot(new_snapshot)
            log.info("PIPELINE FINISHED SILENTLY (No changes and no day rollover)")
            run_silent()
            _update_last_run_success(start_time)
            return

        log.info("STEP 8: Updating daily buffer and finalization check")
        update_daily_buffer_run()

        # Step 9: Regenerate site files
        log.info("STEP 9: Regenerating static site")
        from generate_site import generate_static_files
        generate_static_files()

        # Step 10: Always generate RSS feed
        log.info("STEP 10: Generating RSS feed")
        from generate_site import generate_rss_feed
        generate_rss_feed()

        _update_last_run_success(start_time)
        log.info("=== PIPELINE RUN COMPLETE ===")

    except Exception as e:
        elapsed = (datetime.now() - start_time).total_seconds()
        error_msg = f"Pipeline failed after {elapsed:.1f}s: {e}"
        log.error(error_msg)
        traceback.print_exc()

        # Update last_run.json with error status so frontend can display it
        try:
            last_run_data = load_last_run()
            last_run_data["error"] = str(e)
            last_run_data["error_type"] = type(e).__name__
            last_run_data["failed_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            last_run_data["elapsed_seconds"] = round(elapsed, 1)
            save_last_run(last_run_data)
        except Exception:
            pass  # Don't fail on failure to write error status

        sys.exit(1)


def _update_last_run_success(start_time: datetime):
    """Mark pipeline run as successful in last_run.json with summary report."""
    elapsed = (datetime.now() - start_time).total_seconds()
    try:
        last_run_data = load_last_run()
        last_run_data["error"] = None
        last_run_data["error_type"] = None
        last_run_data["failed_at"] = None
        last_run_data["elapsed_seconds"] = round(elapsed, 1)
        last_run_data["completed_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        # Add summary report
        snapshot = load_json(os.path.join(RAW_DIR, "parsed_bundles.json"), default={})
        last_run_data["summary"] = {
            "total_bundles": len(snapshot),
            "total_apps": sum(len(r.get("apps", [])) for r in snapshot.values()),
            "duration_seconds": round(elapsed, 1),
        }

        save_last_run(last_run_data)
    except Exception:
        pass


def run_silent():
    """Sync data files and run RSS generation for silent pipeline runs with no data changes."""
    from generate_site import generate_static_files, generate_rss_feed
    generate_static_files()
    generate_rss_feed()

    log.info("SILENT RUN COMPLETE (data synced, RSS feed refreshed)")


if __name__ == "__main__":
    run()
