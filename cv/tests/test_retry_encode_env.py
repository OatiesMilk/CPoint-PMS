from pathlib import Path

import pytest

from cpoint_cv.encode import MAX_IMAGE_BYTES, ImageError, jpeg_qualities, sendable, sniff
from cpoint_cv.env import read_env_file, station_env
from cpoint_cv.retry import Backoff

PNG = b"\x89PNG\r\n\x1a\n" + b"\0" * 20
WEBP = b"RIFF\0\0\0\0WEBPVP8 " + b"\0" * 20
JPEG = b"\xff\xd8\xff\xe0" + b"\0" * 20


class TestBackoff:
    def test_doubles_up_to_the_cap(self) -> None:
        b = Backoff(attempts=6, base_seconds=1, max_seconds=5)
        assert list(b.delays(lambda: 1.0)) == [1, 2, 4, 5, 5]

    def test_jitter_shortens_by_at_most_half(self) -> None:
        b = Backoff(attempts=3, base_seconds=2, max_seconds=60)
        assert list(b.delays(lambda: 0.0)) == [1, 2]

    def test_one_attempt_means_no_waits(self) -> None:
        assert list(Backoff(attempts=1).delays()) == []


class TestEncode:
    def test_sniffs_by_bytes_like_the_app(self) -> None:
        assert (sniff(JPEG), sniff(PNG), sniff(WEBP), sniff(b"BM....")) == (
            "jpg",
            "png",
            "webp",
            None,
        )

    @pytest.mark.parametrize(("data", "kind"), [(JPEG, "jpg"), (PNG, "png"), (WEBP, "webp")])
    def test_accepted_images_go_as_they_are(self, data: bytes, kind: str) -> None:
        def never(_data: bytes, _q: int) -> bytes:
            raise AssertionError("shouldn't re-encode")

        assert sendable(data, quality=90, reencode=never) == (data, kind)

    def test_other_formats_are_reencoded_as_jpeg(self) -> None:
        calls: list[int] = []

        def encoder(_data: bytes, q: int) -> bytes:
            calls.append(q)
            return JPEG

        assert sendable(b"BMbitmap", quality=90, reencode=encoder) == (JPEG, "jpg")
        assert calls == [90]

    def test_quality_steps_down_until_it_fits(self) -> None:
        calls: list[int] = []

        def encoder(_data: bytes, q: int) -> bytes:
            calls.append(q)
            return JPEG if q <= 70 else b"\0" * (MAX_IMAGE_BYTES + 1)

        big = JPEG + b"\0" * MAX_IMAGE_BYTES
        assert sendable(big, quality=90, reencode=encoder) == (JPEG, "jpg")
        assert calls == [90, 80, 70]

    def test_refuses_when_nothing_fits(self) -> None:
        with pytest.raises(ImageError, match=r"\[camera\] width and height"):
            sendable(b"x", quality=60, reencode=lambda _d, _q: b"\0" * (MAX_IMAGE_BYTES + 1))

    def test_qualities(self) -> None:
        assert jpeg_qualities(90) == [90, 80, 70, 60, 50]
        assert jpeg_qualities(55) == [55, 50]
        assert jpeg_qualities(50) == [50]


class TestEnv:
    def test_reads_an_env_file(self, tmp_path: Path) -> None:
        path = tmp_path / ".env"
        path.write_text(
            '# station\nCV_DEVICE_TOKEN="cpt_abc"\nexport CV_BASE_URL=http://pc:3001\n\nBAD\n',
            encoding="utf-8",
        )
        assert read_env_file(path) == {
            "CV_DEVICE_TOKEN": "cpt_abc",
            "CV_BASE_URL": "http://pc:3001",
        }

    def test_the_environment_wins_over_the_file(self, tmp_path: Path) -> None:
        path = tmp_path / ".env"
        path.write_text("CV_DEVICE_TOKEN=from-file\nCV_BASE_URL=http://file\n", encoding="utf-8")
        env = station_env({"CV_DEVICE_TOKEN": "from-shell", "CV_BASE_URL": " "}, path)
        assert env["CV_DEVICE_TOKEN"] == "from-shell"
        assert env["CV_BASE_URL"] == "http://file"  # a blank shell value doesn't hide the file

    def test_a_missing_file_is_empty(self, tmp_path: Path) -> None:
        assert read_env_file(tmp_path / "nope") == {}
