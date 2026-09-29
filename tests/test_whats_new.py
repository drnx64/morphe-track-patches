"""Tests for whats_new.py digest rendering and message packing."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))

import whats_new as wn

BANNER = "\U0001D5E7"  # mathematical sans-serif bold T (start of TODAY'S)
RULE = "\u2501"
BUNDLE_MARK = "\u25b8"


def make_bundle(name, apps=2, patches=2):
    return {
        "bundle_name": name,
        "patches_name": name,
        "apps": [
            {
                "name": f"App {i}",
                "pkg": f"com.example.app{i}",
                "patches": [
                    {"name": f"Patch {j}", "badge": "+", "pkg": f"com.example.app{i}"}
                    for j in range(patches)
                ],
            }
            for i in range(apps)
        ],
    }


def make_sections(new_bundles=0, new_apps=0, updated_apps=0, apps=2, patches=2):
    return {
        "new_bundles": [make_bundle(f"NB{i}", apps, patches) for i in range(new_bundles)],
        "new_apps": [make_bundle(f"NA{i}", apps, patches) for i in range(new_apps)],
        "updated_apps": [make_bundle(f"UA{i}", apps, patches) for i in range(updated_apps)],
    }


def pack(sections):
    return wn._pack_blocks(wn._render_blocks(sections))


class TestBanner:
    def test_banner_uses_math_bold_glyphs(self):
        assert wn._render_header().startswith("\U0001D5E7\U0001D5E2\U0001D5D7")

    def test_banner_has_date_and_rule(self):
        header = wn._render_header()
        assert "Date: " in header
        assert RULE * 25 in header

    def test_sans_bold_maps_letters_and_digits(self):
        assert wn._sans_bold("Az9") == "\U0001D5D4\U0001D607\U0001D7F5"

    def test_sans_bold_leaves_other_chars(self):
        assert wn._sans_bold("- ") == "- "


class TestSectionLabels:
    def test_labels_use_bold_underline_and_rule(self):
        for label in wn.SECTION_LABELS.values():
            assert "<b><u>" in label and "</u></b>" in label
            assert RULE * 25 in label

    def test_labels_have_no_square_brackets(self):
        for label in wn.SECTION_LABELS.values():
            assert "[" not in label

    def test_section_order_is_priority_order(self):
        assert wn.SECTION_ORDER == ["new_bundles", "new_apps", "updated_apps"]


class TestBundleRendering:
    def test_bundle_marked_with_triangle_not_hash(self):
        blocks = wn._render_blocks(make_sections(new_bundles=1))
        bundle = [b for b in blocks if b.startswith(BUNDLE_MARK)][0]
        assert bundle.startswith(f"{BUNDLE_MARK} <b>NB0</b>")

    def test_no_literal_hash_marker_anywhere(self):
        blocks = wn._render_blocks(make_sections(new_bundles=2, updated_apps=1))
        for block in blocks:
            assert not block.startswith("# ")

    def test_header_is_first_block(self):
        blocks = wn._render_blocks(make_sections(new_bundles=1))
        assert blocks[0] == wn._render_header()

    def test_empty_sections_yield_banner_only(self):
        assert wn._render_blocks(make_sections()) == [wn._render_header()]

    def test_section_labels_separate_content(self):
        blocks = wn._render_blocks(make_sections(new_bundles=1, updated_apps=1))
        assert wn.SECTION_LABELS["new_bundles"] in blocks
        assert wn.SECTION_LABELS["updated_apps"] in blocks


class TestPacking:
    def test_small_digest_is_one_message(self):
        chunks = pack(make_sections(new_bundles=2))
        assert len(chunks) == 1

    def test_empty_digest_returns_single_banner(self):
        chunks = pack(make_sections())
        assert len(chunks) == 1

    def test_banner_appears_exactly_once(self):
        chunks = pack(make_sections(new_bundles=8, new_apps=8, updated_apps=8, apps=6, patches=5))
        assert sum(c.count("Date: ") for c in chunks) == 1
        assert BANNER in chunks[0]

    def test_continuation_message_starts_with_marker(self):
        chunks = pack(make_sections(new_bundles=8, new_apps=8, updated_apps=8, apps=6, patches=5))
        assert len(chunks) > 1
        for chunk in chunks[1:]:
            assert chunk.startswith(wn.CONT_MARKER)

    def test_no_chunk_exceeds_budget(self):
        chunks = pack(make_sections(new_bundles=8, new_apps=8, updated_apps=8, apps=6, patches=5))
        for chunk in chunks:
            assert len(chunk) <= wn.PACK_BUDGET

    def test_message_count_never_exceeds_cap(self):
        for count in (1, 4, 16):
            chunks = pack(make_sections(new_bundles=count, new_apps=count,
                                        updated_apps=count, apps=4, patches=4))
            assert len(chunks) <= wn.MAX_MESSAGES

    def test_priority_keeps_new_bundles_over_updated_apps(self):
        # one tiny high-priority bundle, a wall of low-priority ones
        sections = make_sections(new_bundles=1, updated_apps=20, apps=6, patches=5)
        chunks = pack(sections)
        joined = "\n".join(chunks)
        assert "NB0" in joined
        assert "UA19" not in joined

    def test_overflow_gets_changelog_pointer(self):
        chunks = pack(make_sections(new_bundles=8, new_apps=8, updated_apps=8, apps=6, patches=5))
        assert "more (" in chunks[-1]
        assert f'href="{wn.SITE_URL}/#/changelog"' in chunks[-1]

    def test_under_budget_has_no_pointer(self):
        chunks = pack(make_sections(new_bundles=2))
        assert "more (" not in chunks[0]

    def test_oversized_bundle_never_splits_a_line(self):
        chunks = pack(make_sections(new_bundles=1, apps=6, patches=5))
        for chunk in chunks:
            for line in chunk.split("\n"):
                if "<a href=" in line:
                    assert line.strip().endswith("</a>")


class TestPackLines:
    def test_returns_none_when_over_capacity(self):
        blocks = [wn._render_header()] + [f"block {i}\nline2" for i in range(50)]
        assert wn._pack_lines(blocks, 100, 2, 0) is None

    def test_returns_chunks_when_within_capacity(self):
        blocks = [wn._render_header(), "bundle one", "bundle two"]
        chunks = wn._pack_lines(blocks, 4000, 2, 0)
        assert chunks is not None and len(chunks) == 1

    def test_reserve_is_held_back_on_final_message(self):
        blocks = [wn._render_header(), "x" * 300, "y" * 150, "z" * 150]
        assert wn._pack_lines(blocks, 400, 2, 300) is None
        assert wn._pack_lines(blocks, 400, 2, 0) is not None
