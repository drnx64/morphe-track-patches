"""Tests for state_manager.py shared utilities."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))

from state_manager import match_release_to_version, COMMON_PACKAGES


class TestMatchReleaseToVersion:
    def test_exact_match(self):
        releases = [{"tag": "v1.0.0"}, {"tag": "v2.0.0"}]
        assert match_release_to_version("v1.0.0", releases) == {"tag": "v1.0.0"}

    def test_exact_match_without_v(self):
        releases = [{"tag": "v1.0.0"}]
        assert match_release_to_version("1.0.0", releases) == {"tag": "v1.0.0"}

    def test_substring_match(self):
        releases = [{"tag": "v1.0.0-beta"}]
        assert match_release_to_version("1.0.0", releases) == {"tag": "v1.0.0-beta"}

    def test_no_match(self):
        releases = [{"tag": "v2.0.0"}]
        assert match_release_to_version("1.0.0", releases) is None

    def test_empty_version(self):
        releases = [{"tag": "v1.0.0"}]
        assert match_release_to_version("", releases) is None

    def test_none_version(self):
        releases = [{"tag": "v1.0.0"}]
        assert match_release_to_version(None, releases) is None

    def test_empty_releases(self):
        assert match_release_to_version("1.0.0", []) is None

    def test_case_insensitive(self):
        releases = [{"tag": "V1.0.0"}]
        assert match_release_to_version("v1.0.0", releases) == {"tag": "V1.0.0"}


class TestCommonPackages:
    def test_youtube(self):
        assert COMMON_PACKAGES["com.google.android.youtube"] == "YouTube"

    def test_whatsapp(self):
        assert COMMON_PACKAGES["com.whatsapp"] == "WhatsApp"

    def test_count(self):
        assert len(COMMON_PACKAGES) == 19
