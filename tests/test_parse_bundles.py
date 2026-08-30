"""Tests for parse_bundles.py — get_app_name pure function."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))

from parse_bundles import get_app_name


def test_known_package():
    assert get_app_name("com.google.android.youtube") == "YouTube"


def test_known_package_case_insensitive():
    assert get_app_name("COM.GOOGLE.ANDROID.YOUTUBE") == "YouTube"


def test_fallback_heuristic():
    name = get_app_name("com.example.myapp")
    assert isinstance(name, str)
    assert len(name) > 0


def test_fallback_strips_android():
    name = get_app_name("com.example.android")
    assert name != "Android" or name == "Example"


def test_fallback_underscores():
    name = get_app_name("com.my_app.test")
    assert "_" not in name


def test_fallback_dashes():
    name = get_app_name("com.my-app.test")
    assert "-" not in name


def test_single_part_package():
    name = get_app_name("myapp")
    assert name == "Myapp"
