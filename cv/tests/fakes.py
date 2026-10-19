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
