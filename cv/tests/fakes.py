"""Test doubles for the station's ports: HTTP, frames and triggers. No network, camera or torch."""

from __future__ import annotations

import json
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from cpoint_cv.sources import Frame
from cpoint_cv.transport import HttpResponse, TransportError

TOKEN = "cpt_test_secret_token_value"
JPEG = b"\xff\xd8\xff\xe0" + b"leather" * 10
BATCH = {
    "batchId": "0199e2b4-1f00-7c3a-8d21-5e6f7a8b9c0d",
    "batchCode": "B-2026-0007",
    "rollCode": "LR-0042",
    "shoeType": "School Shoe",
    "selection": "oldest",
    "stageStartedAt": "2026-10-19T01:00:00.000Z",
}
NO_BATCH_MESSAGE = "No batch is at Preparation. Start one on the Batches page, then scan again."


def reply(status: int, body: Any = None, headers: Mapping[str, str] | None = None) -> HttpResponse:
    raw = b"" if body is None else json.dumps(body).encode()
    return HttpResponse(status, raw, dict(headers or {}))


def error(status: int, code: str, message: str, details: Any = None) -> HttpResponse:
    payload: dict[str, Any] = {"code": code, "message": message}
    if details is not None:
        payload["details"] = details
    return reply(status, {"error": payload})


def batch_ok(**overrides: Any) -> HttpResponse:
    return reply(200, {"data": {**BATCH, **overrides}})


def no_batch() -> HttpResponse:
    return error(404, "NO_BATCH_AT_PREPARATION", NO_BATCH_MESSAGE)


def created(sequence: int = 3, verdict: str = "REWORK", duplicate: bool = False) -> HttpResponse:
    return reply(
        200 if duplicate else 201,
        {
            "data": {
                "scanId": f"scan-{sequence}",
                "batchId": BATCH["batchId"],
                "batchCode": BATCH["batchCode"],
                "sequence": sequence,
                "verdict": verdict,
                "status": "DECIDED",
                "duplicate": duplicate,
            }
        },
    )


@dataclass
class Request:
    method: str
    url: str
    headers: dict[str, str]
    body: bytes | None

    def form(self) -> dict[str, str]:
        """The text fields of a multipart body (the image part is skipped)."""
        assert self.body is not None
        boundary = self.headers["Content-Type"].split("boundary=")[1].encode()
        fields: dict[str, str] = {}
        for part in self.body.split(b"--" + boundary):
            head, _, value = part.partition(b"\r\n\r\n")
            if b'name="' not in head or b"filename=" in head:
                continue
            name = head.split(b'name="')[1].split(b'"')[0].decode()
            fields[name] = value.removesuffix(b"\r\n").decode()
        return fields


class FakeTransport:
    """Answers each request from a script: by path (GET current, POST scans) or in order.

    A script entry is an ``HttpResponse`` or a ``TransportError`` to raise. When a path's script
    runs out, its last entry repeats.
    """

    def __init__(
        self,
        current: Sequence[HttpResponse | TransportError] = (),
        scans: Sequence[HttpResponse | TransportError] = (),
        health: Sequence[HttpResponse | TransportError] = (),
    ) -> None:
        self.scripts: dict[str, list[HttpResponse | TransportError]] = {
            "/api/v1/batches/current": list(current),
            "/api/v1/scans": list(scans),
            "/api/health": list(health),
        }
        self.requests: list[Request] = []

    def request(
        self,
        method: str,
        url: str,
        *,
        headers: Mapping[str, str],
        body: bytes | None = None,
        timeout: float,
    ) -> HttpResponse:
        self.requests.append(Request(method, url, dict(headers), body))
        path = "/" + url.split("://", 1)[1].split("/", 1)[1]
        script = self.scripts[path]
        assert script, f"no scripted answer for {method} {path}"
        answer = script.pop(0) if len(script) > 1 else script[0]
        if isinstance(answer, TransportError):
            raise answer
        return answer

    def posts(self) -> list[Request]:
        return [r for r in self.requests if r.method == "POST"]


class FakeSource:
    def __init__(self, frames: Sequence[Frame]) -> None:
        self._frames = list(frames)
        self.description = f"fake ({len(self._frames)} frames)"
        self.closed = False

    def capture(self) -> Frame | None:
        return self._frames.pop(0) if self._frames else None

    def remaining(self) -> int | None:
        return len(self._frames)

    def close(self) -> None:
        self.closed = True


class FakeTrigger:
    """``presses`` answers in order, then False (stop). Before each answer it calls ``idle``
    ``idles`` times, as a station waiting for the key would."""

    def __init__(self, presses: Sequence[bool], idles: int = 0) -> None:
        self._presses = list(presses)
        self._idles = idles

    def wait(self, idle: Callable[[], None] | None = None) -> bool:
        if idle is not None:
            for _ in range(self._idles):
                idle()
        return self._presses.pop(0) if self._presses else False


class FakeImage:
    """Stands in for an OpenCV frame: only ``shape`` is read."""

    def __init__(self, width: int = 1280, height: int = 720, tag: int = 0) -> None:
        self.shape = (height, width, 3)
        self.tag = tag


class FakeCapture:
    """An OpenCV ``VideoCapture`` double. ``frames`` is how many reads succeed before it drops
    (None: never drops)."""

    def __init__(self, opened: bool = True, frames: int | None = None, width: int = 1280) -> None:
        self._opened = opened
        self._left = frames
        self._width = width
        self.reads = 0
        self.released = False

    def isOpened(self) -> bool:  # OpenCV's names, so the code under test can't tell
        return self._opened

    def read(self) -> tuple[bool, FakeImage | None]:
        self.reads += 1
        if self._left is not None:
            if self._left <= 0:
                return False, None
            self._left -= 1
        return True, FakeImage(self._width, tag=self.reads)

    def release(self) -> None:
        self.released = True


class FakeCv2:
    """``cv2`` as far as camera opening goes. ``cameras`` maps (index, backend) to a capture."""

    CAP_DSHOW = 700

    def __init__(self, cameras: Mapping[tuple[Any, str], FakeCapture]) -> None:
        self._cameras: dict[tuple[Any, str], FakeCapture] = dict(cameras)
        self.opened: list[tuple[int | str, int | None]] = []

    def VideoCapture(self, device: int | str, api: int | None = None) -> FakeCapture:
        self.opened.append((device, api))
        backend = "dshow" if api == self.CAP_DSHOW else "default"
        return self._cameras.get((device, backend), FakeCapture(opened=False))
