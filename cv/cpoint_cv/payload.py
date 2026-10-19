"""The text fields of ``POST /api/v1/scans`` (multipart), exactly as the station sends them.

The image goes alongside as the ``image`` file part (Phase 15). The contract is documented in
``docs/API.md`` and checked from both sides with ``tests/fixtures/cv-payload.json``.
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from datetime import datetime

from .mapper import CONTRACT_MAX_DETECTIONS
from .types import Detection

# The app's ScanSource values (prisma/schema.prisma). Part of the contract, not configuration.
SOURCES = ("SIMULATOR", "PHONE", "WEBCAM", "DEDICATED_CAMERA")


def build_fields(
    detections: Sequence[Detection],
    model_version: str,
    source: str,
    captured_at: datetime,
) -> dict[str, str]:
    if source not in SOURCES:
        raise ValueError(f"source must be one of {', '.join(SOURCES)}; got {source!r}.")
    if captured_at.tzinfo is None or captured_at.utcoffset() is None:
        raise ValueError("captured_at needs a time zone, so capturedAt carries an offset.")
    if len(detections) > CONTRACT_MAX_DETECTIONS:
        raise ValueError(f"at most {CONTRACT_MAX_DETECTIONS} detections can be sent per scan.")
    return {
        "detections": json.dumps([d.to_contract() for d in detections], separators=(",", ":")),
        "modelVersion": model_version,
        "source": source,
        "capturedAt": captured_at.isoformat(timespec="seconds"),
    }
