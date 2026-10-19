"""The HTTP port. ``UrllibTransport`` uses only the standard library; tests pass a fake."""

from __future__ import annotations

import http.client
import json
import socket
import urllib.error
import urllib.request
import uuid
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any, Protocol


class TransportError(Exception):
    """The request got no HTTP answer: refused, timed out, DNS failed or the connection dropped."""


@dataclass(frozen=True)
class HttpResponse:
    status: int
    body: bytes = b""
    headers: Mapping[str, str] = field(default_factory=dict)

    def json(self) -> Any:
        try:
            return json.loads(self.body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return None

    def header(self, name: str) -> str | None:
        wanted = name.lower()
        return next((v for k, v in self.headers.items() if k.lower() == wanted), None)


class Transport(Protocol):
    def request(
        self,
        method: str,
        url: str,
        *,
        headers: Mapping[str, str],
        body: bytes | None = None,
        timeout: float,
    ) -> HttpResponse: ...


class UrllibTransport:
    def request(
        self,
        method: str,
        url: str,
        *,
        headers: Mapping[str, str],
        body: bytes | None = None,
        timeout: float,
    ) -> HttpResponse:
        req = urllib.request.Request(url, data=body, headers=dict(headers), method=method)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as res:
                return HttpResponse(res.status, res.read(), dict(res.headers.items()))
        except urllib.error.HTTPError as error:  # an HTTP answer, just not 2xx
            with error:
                return HttpResponse(error.code, error.read(), dict(error.headers.items()))
        except (urllib.error.URLError, http.client.HTTPException, OSError) as error:
            reason = getattr(error, "reason", error)
            if isinstance(reason, socket.timeout | TimeoutError):
                raise TransportError(f"no answer within {timeout:g} s") from error
            raise TransportError(str(reason) or type(error).__name__) from error


def multipart(
    fields: Mapping[str, str], *, file_field: str, filename: str, content: bytes, mime: str
) -> tuple[bytes, str]:
    """A ``multipart/form-data`` body and its Content-Type header value."""
    boundary = f"cpoint-{uuid.uuid4().hex}"
    parts: list[bytes] = []
    for name, value in fields.items():
        parts.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n'.encode()
            + value.encode("utf-8")
            + b"\r\n"
        )
    parts.append(
        f'--{boundary}\r\nContent-Disposition: form-data; name="{file_field}"; '
        f'filename="{filename}"\r\nContent-Type: {mime}\r\n\r\n'.encode()
        + content
        + b"\r\n"
    )
    parts.append(f"--{boundary}--\r\n".encode())
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"
