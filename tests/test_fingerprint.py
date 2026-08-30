"""Tests for fingerprint_engine.py — pure function tests."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))

from fingerprint_engine import compute_fingerprint


def test_empty_apps():
    fp = compute_fingerprint("my-bundle", [], "stable")
    assert isinstance(fp, str)
    assert len(fp) == 64  # SHA256 hex


def test_string_apps():
    fp1 = compute_fingerprint("b", ["com.a", "com.b"], "stable")
    fp2 = compute_fingerprint("b", ["com.b", "com.a"], "stable")
    assert fp1 == fp2  # order-independent


def test_dict_apps():
    apps = [
        {"package": "com.a", "app_name": "A", "patches": [{"name": "p1"}]},
        {"package": "com.b", "app_name": "B", "patches": []},
    ]
    fp = compute_fingerprint("b", apps, "dev")
    assert isinstance(fp, str)
    assert len(fp) == 64


def test_channel_matters():
    fp1 = compute_fingerprint("b", ["com.a"], "stable")
    fp2 = compute_fingerprint("b", ["com.a"], "dev")
    assert fp1 != fp2


def test_bundle_name_matters():
    fp1 = compute_fingerprint("b1", ["com.a"], "stable")
    fp2 = compute_fingerprint("b2", ["com.a"], "stable")
    assert fp1 != fp2


def test_patch_order_invariant():
    apps1 = [{"package": "com.a", "patches": [{"name": "p2"}, {"name": "p1"}]}]
    apps2 = [{"package": "com.a", "patches": [{"name": "p1"}, {"name": "p2"}]}]
    fp1 = compute_fingerprint("b", apps1, "stable")
    fp2 = compute_fingerprint("b", apps2, "stable")
    assert fp1 == fp2
