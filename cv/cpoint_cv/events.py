"""What the station reports as it works, as data, beside the text it prints.

``run webcam`` ignores these (it prints the text); the station window turns them into its state:
the batch line, the Capture button, the last scan and the "waiting to send" count. Each event's
``message`` is the same plain sentence the console shows.
"""

from __future__ import annotations

from dataclasses import dataclass

from .client import BatchInfo


@dataclass(frozen=True)
class BatchShown:
    """A batch is at Preparation; the next scan goes to it."""

    batch: BatchInfo
    changed: bool = False


@dataclass(frozen=True)
class NoBatchNow:
    """No batch is at Preparation (the app's own message). Nothing is captured until there is."""

    message: str


@dataclass(frozen=True)
class AppUnreachable:
    """The app didn't answer the batch question. Captures still save and go out later."""

    message: str


@dataclass(frozen=True)
class ReadyToCapture:
    """The station waits for the next press."""


@dataclass(frozen=True)
class Captured:
    """A capture is saved in the spool and the model has run on it; sending comes next."""

    label: str
    batch_code: str
    found: str


@dataclass(frozen=True)
class ScanSent:
    """The app has the scan and decided it. ``verdict`` is the app's, never the station's."""

    label: str
    batch_code: str
    sequence: int
    verdict: str
    found: str
    duplicate: bool


@dataclass(frozen=True)
class ScanRefused:
    """The app refused this scan; it's kept in the failed folder with the reason."""

    label: str
    message: str


@dataclass(frozen=True)
class SendDelayed:
    """A scan couldn't be sent yet. It's saved and goes out later, in order."""

    label: str
    message: str


@dataclass(frozen=True)
class Pending:
    """Captures saved and waiting to send."""

    count: int


@dataclass(frozen=True)
class StationStopped:
    """The station stopped. ``problem`` is what a person has to fix, or None for a normal stop."""

    problem: str | None


StationEvent = (
    BatchShown
    | NoBatchNow
    | AppUnreachable
    | ReadyToCapture
    | Captured
    | ScanSent
    | ScanRefused
    | SendDelayed
    | Pending
    | StationStopped
)
