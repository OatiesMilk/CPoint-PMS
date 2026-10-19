"""Talks to the app: ``GET /api/v1/batches/current`` and ``POST /api/v1/scans`` (docs/API.md).

Every answer becomes one plain outcome the station acts on. The app decides verdicts (D-011); the
client only reports what it said. Network errors and 5xx are retried with backoff. That is safe
because every scan carries its ``captureId``: a retry of a scan that did arrive returns the first
scan instead of making a second one (D-051).
"""

from __future__ import annotations

import random
import time
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any

from .retry import Backoff
from .transport import HttpResponse, Transport, TransportError, multipart

TOKEN_REFUSED = (
    "The device token was refused. Ask the System Admin for a new one under API tokens and set "
    "CV_DEVICE_TOKEN."
)


@dataclass(frozen=True)
class BatchInfo:
    batch_id: str
    batch_code: str
    roll_code: str
    shoe_type: str

    def describe(self) -> str:
        return f"{self.batch_code} (roll {self.roll_code}, {self.shoe_type})"


@dataclass(frozen=True)
class Sent:
    scan_id: str
    batch_code: str
    sequence: int
    verdict: str
    status: str
    duplicate: bool
    attempts: int
    http_status: int


@dataclass(frozen=True)
class NoBatch:
    """No batch is at Preparation. The station waits and doesn't capture."""

    message: str
    http_status: int
    attempts: int = 1


@dataclass(frozen=True)
class TokenRefused:
    """401 or 403. The station stops: nothing will work until the token is fixed."""

    message: str
    http_status: int
    attempts: int = 1


@dataclass(frozen=True)
class Rejected:
    """The app refused this scan (413, 422, a 409 for its batch, …). Retrying won't help."""

    message: str
    http_status: int
    attempts: int = 1


@dataclass(frozen=True)
class RetryLater:
    """No answer, or a server error, after every attempt. The capture stays in the spool."""

    reason: str
    attempts: int
    http_status: int | None = None


BatchOutcome = BatchInfo | NoBatch | TokenRefused | RetryLater
SendOutcome = Sent | NoBatch | TokenRefused | Rejected | RetryLater


def error_message(response: HttpResponse) -> str:
    """The app's own message, plus each field error it listed (they name the field)."""
    body = response.json()
    error = body.get("error") if isinstance(body, dict) else None
    if not isinstance(error, dict):
        return f"HTTP {response.status}"
    message = str(error.get("message") or f"HTTP {response.status}")
    details = error.get("details")
    if isinstance(details, list):
        fields = [
            f"{'.'.join(str(p) for p in d.get('path', []))}: {d.get('message')}"
            for d in details
            if isinstance(d, dict) and d.get("message")
        ]
        if fields:
            message = f"{message} ({'; '.join(fields)})"
    return message


def _refused(response: HttpResponse, attempts: int = 1) -> TokenRefused:
    if response.status == 401:
        return TokenRefused(TOKEN_REFUSED, 401, attempts)
    return TokenRefused(
        f"{error_message(response)} Ask the System Admin for a device token with the "
        "scans:create scope and set CV_DEVICE_TOKEN.",
        response.status,
        attempts,
    )


class ScanClient:
    def __init__(
        self,
        base_url: str,
        token: str,
        transport: Transport,
        *,
        timeout: float = 30.0,
        backoff: Backoff | None = None,
        sleep: Callable[[float], None] = time.sleep,
        rand: Callable[[], float] = random.random,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self._token = token
        self._transport = transport
        self._timeout = timeout
        self._backoff = backoff or Backoff()
        self._sleep = sleep
        self._rand = rand

    def __repr__(self) -> str:  # never show the token
        return f"ScanClient(base_url={self.base_url!r}, token=<hidden>)"

    def _auth(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._token}", "Accept": "application/json"}

    def health(self) -> HttpResponse:
        """``GET /api/health``. Raises ``TransportError`` when the app can't be reached."""
        return self._transport.request(
            "GET", f"{self.base_url}/api/health", headers={}, timeout=self._timeout
        )

    def current_batch(self) -> BatchOutcome:
        """One attempt: the station's loop asks again on its own schedule."""
        try:
            response = self._transport.request(
                "GET",
                f"{self.base_url}/api/v1/batches/current",
                headers=self._auth(),
                timeout=self._timeout,
            )
        except TransportError as error:
            return RetryLater(str(error), attempts=1)
        if response.status == 200:
            data = _data(response)
            return BatchInfo(
                batch_id=str(data.get("batchId", "")),
                batch_code=str(data.get("batchCode", "")),
                roll_code=str(data.get("rollCode", "")),
                shoe_type=str(data.get("shoeType", "")),
            )
        if response.status == 404:
            return NoBatch(error_message(response), 404)
        if response.status in (401, 403):
            return _refused(response)
        return RetryLater(error_message(response), attempts=1, http_status=response.status)

    def send(
        self, fields: Mapping[str, str], image: bytes, filename: str, mime: str
    ) -> SendOutcome:
        body, content_type = multipart(
            fields, file_field="image", filename=filename, content=image, mime=mime
        )
        headers = {**self._auth(), "Content-Type": content_type}
        delays = list(self._backoff.delays(self._rand))
        last = RetryLater("not sent", attempts=0)
        for attempt in range(1, len(delays) + 2):
            try:
                response = self._transport.request(
                    "POST",
                    f"{self.base_url}/api/v1/scans",
                    headers=headers,
                    body=body,
                    timeout=self._timeout,
                )
            except TransportError as error:
                last = RetryLater(str(error), attempts=attempt)
            else:
                outcome = self._outcome(response, attempt, pinned="batchId" in fields)
                if not isinstance(outcome, RetryLater):
                    return outcome
                last = outcome
            if attempt <= len(delays):
                self._sleep(delays[attempt - 1])
        return last

    @staticmethod
    def _outcome(response: HttpResponse, attempt: int, *, pinned: bool) -> SendOutcome:
        status = response.status
        if status in (200, 201):
            data = _data(response)
            return Sent(
                scan_id=str(data.get("scanId", "")),
                batch_code=str(data.get("batchCode", "")),
                sequence=int(data.get("sequence", 0)),
                verdict=str(data.get("verdict", "")),
                status=str(data.get("status", "")),
                duplicate=bool(data.get("duplicate", status == 200)),
                attempts=attempt,
                http_status=status,
            )
        if status in (401, 403):
            return _refused(response, attempt)
        if status == 409 and not pinned:
            return NoBatch(error_message(response), status, attempt)
        if status >= 500:
            return RetryLater(error_message(response), attempts=attempt, http_status=status)
        return Rejected(error_message(response), status, attempts=attempt)


def _data(response: HttpResponse) -> dict[str, Any]:
    body = response.json()
    data = body.get("data") if isinstance(body, dict) else None
    return data if isinstance(data, dict) else {}
