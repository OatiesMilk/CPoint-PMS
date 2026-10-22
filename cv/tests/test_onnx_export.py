"""``export-onnx`` writes the ONNX file and the sidecar JSON the app reads (Phase 18, D-064)."""

import hashlib
import json
from pathlib import Path

import pytest

from cpoint_cv.cli import main
from cpoint_cv.config import Config, ModelConfig
from cpoint_cv.mapper import MapperConfig
from cpoint_cv.onnx_export import Exported, ExportError, export_onnx, sidecar

NAMES = {0: "crease", 1: "cut", 2: "hole", 3: "scratch"}


def _config(tmp_path: Path) -> Config:
    pt = tmp_path / "models" / "yolo-v1.pt"
    pt.parent.mkdir()
    pt.write_bytes(b"weights")
    return Config(
        model=ModelConfig(path=pt, name="yolo-v1", imgsz=1536),
        mapper=MapperConfig(confidence_floor=0.3, rename={"crease": "wrinkle"}, overlap_iou=0.6),
    )


def _fake_exporter(model: ModelConfig) -> Exported:
    # Ultralytics writes the file beside the weights, named after them.
    out = model.path.with_suffix(".onnx")
    out.write_bytes(b"onnx graph")
    return Exported(out, NAMES)


def test_export_writes_the_onnx_file_and_its_sidecar(tmp_path: Path) -> None:
    config = _config(tmp_path)
    onnx_path, info = export_onnx(config, _fake_exporter)

    assert onnx_path == tmp_path / "models" / "yolo-v1.onnx"
    assert info == tmp_path / "models" / "yolo-v1.json"
    data = json.loads(info.read_text(encoding="utf-8"))
    weights_sha = hashlib.sha256(b"weights").hexdigest()
    assert data == {
        # The weights' version, so predict and the website read as one model.
        "modelVersion": f"yolo-v1-{weights_sha[:8]}",
        "names": {"0": "crease", "1": "cut", "2": "hole", "3": "scratch"},
        "imgsz": 1536,
        "stride": 32,
        "onnxSha256": hashlib.sha256(b"onnx graph").hexdigest(),
        "confidenceFloor": 0.3,
        "overlapIou": 0.6,
        "rename": {"crease": "wrinkle"},
    }


def test_export_moves_a_file_written_elsewhere_beside_the_weights(tmp_path: Path) -> None:
    config = _config(tmp_path)

    def elsewhere(model: ModelConfig) -> Exported:
        out = tmp_path / "runs" / "export.onnx"
        out.parent.mkdir()
        out.write_bytes(b"onnx graph")
        return Exported(out, NAMES)

    onnx_path, _ = export_onnx(config, elsewhere)
    assert onnx_path.read_bytes() == b"onnx graph"
    assert not (tmp_path / "runs" / "export.onnx").exists()


def test_export_says_which_file_is_missing(tmp_path: Path) -> None:
    config = Config(model=ModelConfig(path=tmp_path / "nope.pt", name="yolo-v1"))
    with pytest.raises(ExportError, match=r"nope\.pt wasn't found"):
        export_onnx(config, _fake_exporter)


def test_sidecar_sorts_class_names_by_index() -> None:
    data = sidecar("m-00000000", {2: "hole", 0: "crease"}, 640, "0" * 64, MapperConfig())
    assert list(data["names"]) == ["0", "2"]
    assert data["confidenceFloor"] == 0.25
    assert data["overlapIou"] == 0.7


def test_the_command_reports_a_missing_config(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    assert main(["export-onnx", "--config", str(tmp_path / "none.toml")]) == 2
    assert "error:" in capsys.readouterr().err
