from datetime import UTC, datetime
from pathlib import Path

from fakes import TOKEN, FakeTransport, batch_ok, error, no_batch, reply

from cpoint_cv.client import TOKEN_REFUSED, ScanClient
from cpoint_cv.config import parse_config
from cpoint_cv.doctor import check_app, check_camera, check_model, check_python, pinned_versions
from cpoint_cv.model_info import sha256_file
from cpoint_cv.transport import HttpResponse, TransportError

SERVER_DATE = "Mon, 19 Oct 2026 01:30:00 GMT"
SERVER_NOW = datetime(2026, 10, 19, 1, 30, 0, tzinfo=UTC)


def client(t: FakeTransport) -> ScanClient:
    return ScanClient("http://localhost:3000", TOKEN, t, sleep=lambda _s: None)


def health_ok() -> HttpResponse:
    return reply(200, {"status": "ok"}, {"Date": SERVER_DATE})


class TestModel:
    def test_missing_file_says_where_to_put_it(self, tmp_path: Path) -> None:
        config = parse_config({"model": {"path": "models/none.pt"}}, base_dir=tmp_path)
        check = check_model(config)
        assert not check.ok and "cv/models/" in check.detail

    def test_checksum_mismatch_fails(self, tmp_path: Path) -> None:
        (tmp_path / "m.pt").write_bytes(b"weights")
        config = parse_config({"model": {"path": "m.pt", "sha256": "0" * 64}}, base_dir=tmp_path)
        check = check_model(config)
        assert not check.ok and "doesn't match [model] sha256" in check.detail

    def test_matching_file_passes(self, tmp_path: Path) -> None:
        (tmp_path / "m.pt").write_bytes(b"weights")
        sha = sha256_file(tmp_path / "m.pt")
        config = parse_config({"model": {"path": "m.pt", "sha256": sha}}, base_dir=tmp_path)
        assert check_model(config).ok


class TestPython:
    def test_versions_against_the_pins(self) -> None:
        installed = {"torch": "2.6.0+cu124", "numpy": "2.4.0"}
        checks = check_python(
            "3.13.5",
            {"torch": "2.6.0", "numpy": "2.5.2", "ultralytics": "8.4.103"},
            installed.get,
        )
        by_name = {c.name: c for c in checks}
        assert by_name["Python"].ok
        assert by_name["torch"].ok  # the CUDA build's +cu124 suffix is fine
        assert not by_name["numpy"].ok and "needs 2.5.2" in by_name["numpy"].detail
        assert not by_name["ultralytics"].ok
        assert "not installed" in by_name["ultralytics"].detail

    def test_old_python_fails(self) -> None:
        assert not check_python("3.11.9", {}, lambda _p: None)[0].ok

    def test_reads_the_requirements_pins(self) -> None:
        pins = pinned_versions()
        assert pins["ultralytics"] == "8.4.103"


def test_camera_check_reports_the_probe() -> None:
    assert check_camera(0, lambda _i: None).ok
    failed = check_camera(1, lambda _i: "Camera 1 couldn't be opened.")
    assert not failed.ok and failed.detail == "Camera 1 couldn't be opened."


class TestApp:
    def test_no_token_says_how_to_get_one(self) -> None:
        [check] = check_app(None)
        assert not check.ok and "CV_DEVICE_TOKEN" in check.detail and "API tokens" in check.detail

    def test_unreachable_app(self) -> None:
        [check] = check_app(client(FakeTransport(health=[TransportError("connection refused")])))
        assert not check.ok and "npm run dev" in check.detail

    def test_all_good_with_a_batch(self) -> None:
        t = FakeTransport(health=[health_ok()], current=[batch_ok()])
        checks = check_app(client(t), now=lambda: SERVER_NOW)
        assert all(c.ok for c in checks), checks
        assert "B-2026-0007" in checks[1].detail

    def test_no_batch_still_means_the_token_works(self) -> None:
        t = FakeTransport(health=[health_ok()], current=[no_batch()])
        token = check_app(client(t), now=lambda: SERVER_NOW)[1]
        assert token.ok and "no batch is at Preparation" in token.detail

    def test_refused_token(self) -> None:
        t = FakeTransport(
            health=[health_ok()],
            current=[error(401, "UNAUTHENTICATED", "Invalid token.")],
        )
        token = check_app(client(t), now=lambda: SERVER_NOW)[1]
        assert not token.ok and token.detail == TOKEN_REFUSED

    def test_unhealthy_app(self) -> None:
        t = FakeTransport(health=[reply(503, {"status": "degraded"})], current=[no_batch()])
        app = check_app(client(t))[0]
        assert not app.ok and "database" in app.detail

    def test_a_clock_far_ahead_fails(self) -> None:
        t = FakeTransport(health=[health_ok()], current=[batch_ok()])
        ahead = SERVER_NOW.replace(minute=40)
        clock = check_app(client(t), now=lambda: ahead)[2]
        assert not clock.ok and "600 s ahead of the app" in clock.detail
