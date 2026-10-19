import hashlib
from pathlib import Path

import pytest

from cpoint_cv.model_info import model_version, sha256_file


def test_sha256_of_a_file(tmp_path: Path) -> None:
    f = tmp_path / "m.pt"
    f.write_bytes(b"weights" * 300_000)  # bigger than one read chunk
    assert sha256_file(f) == hashlib.sha256(b"weights" * 300_000).hexdigest()


def test_model_version_is_the_name_and_eight_hex_digits() -> None:
    sha = "1d729fb0358d3140d5491d4124e2173ec228e42875e06a31a69f4530d83f157b"
    assert model_version("yolo-v1", sha) == "yolo-v1-1d729fb0"


def test_model_version_fits_the_apps_60_characters() -> None:
    sha = "a" * 64
    assert len(model_version("n" * 51, sha)) == 60
    with pytest.raises(ValueError, match="at most 60"):
        model_version("n" * 52, sha)


@pytest.mark.parametrize("name", ["", "-v1", "yolo v1", "yolo/v1"])
def test_model_names_are_plain(name: str) -> None:
    with pytest.raises(ValueError, match="model name"):
        model_version(name, "a" * 64)
