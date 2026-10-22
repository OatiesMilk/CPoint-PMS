"""The text fields of ``POST /api/v1/scans`` (multipart), as a device-token client sends them.

Nothing in the toolkit posts scans since the station was retired (Phase 20, D-069). This builder
stays so ``tests/test_contract_fixture.py`` can still write ``tests/fixtures/cv-payload.json``,
which the app's ``tests/unit/cv-contract.test.ts`` parses: the mapper's output in the contract's
shape, checked from both sides. The contract is documented in ``docs/API.md``.
"""

from __future__ import annotations

import json
import uuid
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
    *,
    capture_id: str | None = None,
    batch_id: str | None = None,
) -> dict[str, str]:
    """``capture_id`` makes a retry safe (D-051); ``batch_id`` pins the batch shown at capture."""
    if source not in SOURCES:
        raise ValueError(f"source must be one of {', '.join(SOURCES)}; got {source!r}.")
    if captured_at.tzinfo is None or captured_at.utcoffset() is None:
        raise ValueError("captured_at needs a time zone, so capturedAt carries an offset.")
    if len(detections) > CONTRACT_MAX_DETECTIONS:
        raise ValueError(f"at most {CONTRACT_MAX_DETECTIONS} detections can be sent per scan.")
    if capture_id is not None:
        try:
            uuid.UUID(capture_id)
        except ValueError:
            raise ValueError(f"capture_id must be a UUID; got {capture_id!r}.") from None
    fields = {
        "detections": json.dumps([d.to_contract() for d in detections], separators=(",", ":")),
        "modelVersion": model_version,
        "source": source,
        "capturedAt": captured_at.isoformat(timespec="seconds"),
    }
    if capture_id is not None:
        fields["captureId"] = capture_id
    if batch_id is not None:
        fields["batchId"] = batch_id
    return fields
