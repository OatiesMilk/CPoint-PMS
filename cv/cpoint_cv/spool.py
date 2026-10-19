"""The station's outbox. Every capture is saved here before it is sent and removed only once the
app has answered, so nothing is lost when the network, the app or the station itself stops.

Each capture is a folder ``<captured at, UTC>-<captureId>/`` holding the image and
``capture.json`` (the form fields to send, the batch and a label). Names sort by capture time, so
captures go out in the order they were taken. A capture the app refused moves to the failed folder
with ``reason.txt``; a capture interrupted before the model ran (no ``capture.json``) moves there
too.
"""

from __future__ import annotations

import json
import os
import shutil
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .encode import MIME

RECORD = "capture.json"
REASON = "reason.txt"


@dataclass(frozen=True)
class Entry:
    folder: Path
    image: Path
    record: dict[str, Any]

    @property
    def fields(self) -> dict[str, str]:
        return {str(k): str(v) for k, v in self.record["fields"].items()}

    @property
    def label(self) -> str:
        return str(self.record.get("label", self.folder.name))

    @property
    def batch_code(self) -> str:
        return str(self.record.get("batchCode", ""))

    @property
    def mime(self) -> str:
        return MIME.get(self.image.suffix.lstrip("."), "application/octet-stream")


def entry_name(captured_at: datetime, capture_id: str) -> str:
    return f"{captured_at.astimezone(UTC):%Y%m%dT%H%M%S%fZ}-{capture_id}"


class Spool:
    def __init__(self, root: Path, failed_root: Path) -> None:
        self.root = root
        self.failed_root = failed_root

    def create(self, captured_at: datetime, capture_id: str, image: bytes, kind: str) -> Path:
        """Save the image at once, before the model runs. Returns its path."""
        folder = self.root / entry_name(captured_at, capture_id)
        folder.mkdir(parents=True, exist_ok=False)
        path = folder / f"image.{kind}"
        path.write_bytes(image)
        return path

    def complete(self, image: Path, record: dict[str, Any]) -> Entry:
        """Write ``capture.json`` (atomically) so the capture is ready to send."""
        target = image.parent / RECORD
        temporary = target.with_suffix(".tmp")
        temporary.write_text(json.dumps(record, indent=2), encoding="utf-8")
        os.replace(temporary, target)
        return Entry(image.parent, image, record)

    def pending(self) -> list[Entry]:
        """Ready captures, oldest first. Broken or unfinished ones move to the failed folder."""
        if not self.root.is_dir():
            return []
        entries: list[Entry] = []
        for folder in sorted(p for p in self.root.iterdir() if p.is_dir()):
            images = sorted(p for p in folder.glob("image.*") if p.suffix != ".tmp")
            record_path = folder / RECORD
            if not images or not record_path.is_file():
                self._move(folder, "The station stopped before the model ran on this capture.")
                continue
            try:
                record = json.loads(record_path.read_text(encoding="utf-8"))
                if not isinstance(record, dict) or not isinstance(record.get("fields"), dict):
                    raise ValueError("no fields")
            except (ValueError, OSError) as error:
                self._move(folder, f"capture.json couldn't be read ({error}).")
                continue
            entries.append(Entry(folder, images[0], record))
        return entries

    def count(self) -> int:
        return len([p for p in self.root.iterdir() if p.is_dir()]) if self.root.is_dir() else 0

    def remove(self, entry: Entry) -> None:
        shutil.rmtree(entry.folder)

    def fail(self, entry: Entry, reason: str) -> Path:
        return self._move(entry.folder, reason)

    def _move(self, folder: Path, reason: str) -> Path:
        self.failed_root.mkdir(parents=True, exist_ok=True)
        target = self.failed_root / folder.name
        shutil.move(str(folder), str(target))
        (target / REASON).write_text(reason + "\n", encoding="utf-8")
        return target
