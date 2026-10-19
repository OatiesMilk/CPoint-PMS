from pathlib import Path

import pytest

from cpoint_cv.config import CV_DIR, ConfigError, load_config, parse_config
from cpoint_cv.sources import camera_name

BASE = Path("/station")
MINIMAL = {"model": {"path": "models/yolo-v1.pt"}}


def test_defaults_from_a_minimal_file() -> None:
    c = parse_config(MINIMAL, base_dir=BASE)
    assert c.model.name == "yolo-v1"  # from the file name
    assert (c.model.imgsz, c.model.device, c.model.sha256) == (1536, "cpu", None)
    assert c.model.path == (BASE / "models/yolo-v1.pt").resolve()
    assert (c.mapper.confidence_floor, c.mapper.max_detections) == (0.25, 50)
    assert c.preview.active_keys == frozenset()  # defect types come from the file, not the code


def test_the_example_config_loads_and_matches_todays_settings() -> None:
    c = load_config(CV_DIR / "config.example.toml", env={})
    assert c.model.path == (CV_DIR / "models" / "yolo-v1.pt").resolve()
    assert c.model.device == "cpu"
    assert c.preview.active_keys == {"crease", "cut", "hole", "scratch"}
    assert c.preview.inactive_keys == {"abrasion", "dirt"}
    assert c.server.base_url == "http://localhost:3000"
    assert c.station.spool_dir == (CV_DIR / "out" / "spool").resolve()
    assert (c.station.scan_source, c.camera.index) == ("WEBCAM", 0)
    assert (c.preview.reject_at_or_above, c.preview.rework_at_or_above) == (0.9, 0.6)


def test_environment_overrides_the_file() -> None:
    env = {
        "CPOINT_CV_MODEL_DEVICE": "cuda:0",
        "CPOINT_CV_MODEL_IMGSZ": "640",
        "CPOINT_CV_CONFIDENCE_FLOOR": "0.1",
        "CPOINT_CV_MODEL_PATH": "",  # blank values are ignored
    }
    c = parse_config(MINIMAL, base_dir=BASE, env=env)
    assert (c.model.device, c.model.imgsz, c.mapper.confidence_floor) == ("cuda:0", 640, 0.1)
    assert c.model.path.name == "yolo-v1.pt"


def test_rename_map_is_read() -> None:
    c = parse_config({**MINIMAL, "mapper": {"rename": {"crease": " wrinkle "}}}, base_dir=BASE)
    assert c.mapper.rename == {"crease": "wrinkle"}


@pytest.mark.parametrize(
    ("data", "message"),
    [
        ({"model": {}}, r"\[model\] path is missing"),
        ({"model": {"path": "m.pt", "imgsz": 1000}}, r"imgsz must be a multiple of 32"),
        ({"model": {"path": "m.pt", "imgsz": "big"}}, r"imgsz must be a whole number"),
        ({"model": {"path": "m.pt", "device": "gpu"}}, r"device must be"),
        ({"model": {"path": "m.pt", "sha256": "abc"}}, r"sha256 must be the 64-character"),
        ({**MINIMAL, "mapper": {"confidence_floor": 1.5}}, r"confidence_floor must be from"),
        ({**MINIMAL, "mapper": {"max_detections": 51}}, r"max_detections must be from 1 to 50"),
        ({**MINIMAL, "mapper": {"rename": {"crease": ""}}}, r"\[mapper.rename\]"),
        (
            {**MINIMAL, "preview": {"reject_at_or_above": 0.5, "rework_at_or_above": 0.6}},
            r"rework_at_or_above must be lower",
        ),
        ({**MINIMAL, "preview": {"active_keys": "cut"}}, r"active_keys must be a list"),
        (
            {**MINIMAL, "preview": {"active_keys": ["cut"], "inactive_keys": ["cut"]}},
            r"cut can't be both active and inactive",
        ),
    ],
)
def test_each_bad_setting_is_named(data: dict[str, object], message: str) -> None:
    with pytest.raises(ConfigError, match=message):
        parse_config(data, base_dir=BASE)


def test_a_missing_file_says_how_to_create_one(tmp_path: Path) -> None:
    with pytest.raises(ConfigError, match=r"Copy cv/config.example.toml"):
        load_config(tmp_path / "nope.toml", env={})


def test_broken_toml_is_reported(tmp_path: Path) -> None:
    bad = tmp_path / "config.toml"
    bad.write_text("[model\npath = 1", encoding="utf-8")
    with pytest.raises(ConfigError, match="isn't valid TOML"):
        load_config(bad, env={})


def test_station_defaults_from_a_minimal_file() -> None:
    c = parse_config(MINIMAL, base_dir=BASE)
    assert c.server.base_url == "http://localhost:3000"
    assert (c.server.timeout_seconds, c.server.attempts) == (30.0, 4)
    assert (c.server.backoff_seconds, c.server.max_backoff_seconds) == (1.0, 15.0)
    assert c.station.scan_source == "WEBCAM"
    assert c.station.spool_dir == (BASE / "out/spool").resolve()
    assert c.station.failed_dir == (BASE / "out/failed").resolve()
    assert (c.station.jpeg_quality, c.station.interval_seconds) == (90, 3.0)
    assert (c.camera.index, c.camera.width, c.camera.height) == (0, 1920, 1080)


def test_cv_base_url_overrides_the_file_and_trailing_slashes_go() -> None:
    data = {**MINIMAL, "server": {"base_url": "http://localhost:3000"}}
    c = parse_config(data, base_dir=BASE, env={"CV_BASE_URL": "http://192.168.1.20:3001/"})
    assert c.server.base_url == "http://192.168.1.20:3001"


@pytest.mark.parametrize(
    ("section", "values", "message"),
    [
        ("server", {"base_url": "localhost:3000"}, "must start with http:// or https://"),
        ("server", {"attempts": 0}, r"\[server\] attempts must be from 1 to 10"),
        (
            "server",
            {"backoff_seconds": 5, "max_backoff_seconds": 2},
            "max_backoff_seconds can't be below backoff_seconds",
        ),
        ("station", {"scan_source": "SIMULATOR"}, "scan_source must be WEBCAM or DEDICATED_CAMERA"),
        ("station", {"jpeg_quality": 30}, r"\[station\] jpeg_quality must be from 50 to 100"),
        ("station", {"spool_dir": ""}, r"\[station\] spool_dir must be a folder path"),
        ("camera", {"index": -1}, r"\[camera\] index must be from 0 to 99"),
    ],
)
def test_station_settings_name_the_setting_and_the_fix(
    section: str, values: dict[str, object], message: str
) -> None:
    with pytest.raises(ConfigError, match=message):
        parse_config({**MINIMAL, section: values}, base_dir=BASE)


def test_camera_url_overlap_and_check_in(tmp_path: Path) -> None:
    config = parse_config(
        {
            "model": {"path": "m.pt"},
            "camera": {"url": "rtsp://cam:secret@192.168.1.50:554/stream1"},
            "mapper": {"overlap_iou": 0.5},
            "station": {"check_in_seconds": 0},
        },
        base_dir=tmp_path,
    )
    assert config.camera.device == "rtsp://cam:secret@192.168.1.50:554/stream1"
    assert config.mapper.overlap_iou == 0.5
    assert config.station.check_in_seconds == 0
    defaults = parse_config({"model": {"path": "m.pt"}, "camera": {"url": ""}}, base_dir=tmp_path)
    assert defaults.camera.device == 0
    assert defaults.mapper.overlap_iou == 0.7
    assert defaults.station.check_in_seconds == 20


def test_camera_url_from_the_environment_and_a_bad_one(tmp_path: Path) -> None:
    env = {"CPOINT_CV_CAMERA_URL": "http://192.168.1.60/video"}
    config = parse_config({"model": {"path": "m.pt"}}, base_dir=tmp_path, env=env)
    assert config.camera.device == "http://192.168.1.60/video"
    with pytest.raises(ConfigError, match=r"\[camera\] url must start with rtsp://"):
        parse_config(
            {"model": {"path": "m.pt"}, "camera": {"url": "192.168.1.60"}}, base_dir=tmp_path
        )


def test_camera_name_hides_the_password() -> None:
    assert camera_name(0) == "camera 0"
    assert camera_name("rtsp://cam:secret@10.0.0.5/s1") == "IP camera rtsp://10.0.0.5/s1"


def test_preview_actions(tmp_path: Path) -> None:
    config = parse_config(
        {
            "model": {"path": "m.pt"},
            "preview": {
                "found_at_or_above": 0.45,
                "actions": {"hole": "reject", "crease": "REWORK"},
            },
        },
        base_dir=tmp_path,
    )
    assert config.preview.actions == {"hole": "REJECT", "crease": "REWORK"}
    assert config.preview.found_at_or_above == 0.45
    with pytest.raises(ConfigError, match=r"\[preview.actions\]"):
        parse_config(
            {"model": {"path": "m.pt"}, "preview": {"actions": {"hole": "DISCARD"}}},
            base_dir=tmp_path,
        )
