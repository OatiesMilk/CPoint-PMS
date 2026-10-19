from pathlib import Path

from cpoint_cv.cli import preview_warning, settings_line
from cpoint_cv.config import parse_config


def config(preview: dict[str, object]):  # type: ignore[no-untyped-def]
    return parse_config({"model": {"path": "m.pt"}, "preview": preview}, base_dir=Path("/s"))


def test_warns_when_the_preview_has_no_actions() -> None:
    bare = config({})
    warning = preview_warning(bare)
    assert warning is not None and "[preview.actions] is empty" in warning
    assert 'no "When found" actions (by confidence only)' in settings_line(bare)


def test_no_warning_once_actions_are_set() -> None:
    with_actions = config({"found_at_or_above": 0.5, "actions": {"cut": "REJECT"}})
    assert preview_warning(with_actions) is None
    assert "when found at 0.50: cut reject" in settings_line(with_actions)
