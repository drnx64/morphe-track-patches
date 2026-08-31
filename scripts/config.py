"""Centralized configuration for MorpheTracker pipeline.

All tuneable values in one place. Override via environment variables.
"""
import os

# Pipeline schedule
SCAN_INTERVAL_HOURS = int(os.environ.get("SCAN_INTERVAL_HOURS", "3"))

# Cooldown — skip full pipeline if last successful run was less than this many hours ago.
# Acts as the effective scan interval; cron fires hourly but pipeline self-throttles.
SCANNER_COOLDOWN_HOURS = float(os.environ.get("SCANNER_COOLDOWN_HOURS", "2.5"))

# Changelog
CHANGELOG_MAX_ENTRIES = int(os.environ.get("CHANGELOG_MAX_ENTRIES", "7"))

# Release cache — only refresh when cache is older than this (hours)
RELEASE_CACHE_TTL_HOURS = int(os.environ.get("RELEASE_CACHE_TTL_HOURS", "24"))

# HTTP retries
HTTP_MAX_RETRIES = int(os.environ.get("HTTP_MAX_RETRIES", "3"))
HTTP_TIMEOUT_SECONDS = int(os.environ.get("HTTP_TIMEOUT_SECONDS", "30"))

# Icon cache
ICON_CACHE_MAX_ENTRIES = int(os.environ.get("ICON_CACHE_MAX_ENTRIES", "600"))

# Announcement expiry (ms)
ANNOUNCEMENT_EXPIRY_MS = int(os.environ.get("ANNOUNCEMENT_EXPIRY_MS", "86400000"))

# Download skip cache — bundles skipped as incomplete/non-morphe are cached
# and only retried after this many days.
SKIP_CACHE_TTL_DAYS = int(os.environ.get("SKIP_CACHE_TTL_DAYS", "30"))
