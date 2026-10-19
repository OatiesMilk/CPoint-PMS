"""One JSON line per event in ``<log dir>/station-YYYY-MM-DD.jsonl``: captures, sends, retries and
waits. The token is never passed in, so it can't be written."""

from __future__ import annotations

import json
from collections.abc import Callable
from datetime import datetime
from pathlib import Path
from typing import Any


class StationLog:
    def __init__(
        self, folder: Path, clock: Callable[[], datetime] = lambda: datetime.now().astimezone()
    ) -> None:
        self.folder = folder
        self._clock = clock

    def write(self, event: str, **fields: Any) -> None:
        now = self._clock()
        self.folder.mkdir(parents=True, exist_ok=True)
        line = {"time": now.isoformat(timespec="milliseconds"), "event": event, **fields}
        path = self.folder / f"station-{now:%Y-%m-%d}.jsonl"
        with path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(line, default=str) + "\n")
