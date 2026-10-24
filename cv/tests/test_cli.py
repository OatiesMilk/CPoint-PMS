from pathlib import Path

from cpoint_cv.cli import NO_TYPES_WARNING, preview_warnings, settings_line
from cpoint_cv.config import parse_config


def config(preview: dict[str, object]):  # type: ignore[no-untyped-def]
    return parse_config({"model": {"path": "m.pt"}, "preview": preview}, base_dir=Path("/s"))


def test_warns_when_the_preview_has_no_defect_types() -> None:
    bare = config({})
    assert preview_warnings(bare) == [NO_TYPES_WARNING]
    assert "Not accepted (Reject): none; Usable (Pass): none" in settings_line(bare)


def test_no_warning_once_types_and_outcomes_are_set() -> None:
    set_up = config(
        {
            "active_keys": ["cut", "crease"],
            "found_at_or_above": 0.5,
            "outcomes": {"cut": "NOT_ACCEPTED", "crease": "USABLE"},
        }
    )
    assert preview_warnings(set_up) == []
    line = settings_line(set_up)
    assert "found at 0.50; Not accepted (Reject): cut; Usable (Pass): crease" in line
    assert "unknown classes: Reject" in line


def test_names_each_retired_setting() -> None:
    old = config({"active_keys": ["cut"], "outcomes": {"cut": "NOT_ACCEPTED"}, "actions": {}})
    assert len(preview_warnings(old)) == 1
    assert preview_warnings(old)[0].startswith("warning: [preview] actions is no longer used")
