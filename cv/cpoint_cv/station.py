"""The camera station loop (D-050): know the batch, capture one section, run the model, send it.

    resend what's waiting → ask which batch is at Preparation → wait for the trigger
    → capture → save to the spool → detect → send with the pinned batchId and a captureId

The app decides every verdict (D-011); the station prints what the app answered. A capture is
always saved before it's sent, so a network or server failure only delays it, in order.
"""

from __future__ import annotations

import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime

from .client import BatchInfo, NoBatch, Rejected, RetryLater, ScanClient, Sent, TokenRefused
from .config import Config
from .detector import Detector
from .encode import ImageError, sendable
from .logs import StationLog
from .mapper import map_detections
from .payload import build_fields
from .sources import FrameSource, SourceError
from .spool import Entry, Spool
from .triggers import Trigger
from .types import Detection


class StationStop(Exception):
    """Nothing more will work until a person fixes something (the token, the camera)."""


def describe_detections(detections: list[Detection]) -> str:
    if not detections:
        return "nothing found"
    top = detections[0]
    more = f" and {len(detections) - 1} more" if len(detections) > 1 else ""
    return f"{top.class_key} {top.confidence:.2f}{more}"


@dataclass
class Station:
    config: Config
    source: FrameSource
    trigger: Trigger
    detector: Detector
    client: ScanClient
    spool: Spool
    log: StationLog
    model_version: str
    say: Callable[[str], None] = print
    clock: Callable[[], datetime] = field(default=lambda: datetime.now().astimezone())
    sleep: Callable[[float], None] = time.sleep
    new_id: Callable[[], str] = field(default=lambda: str(uuid.uuid4()))
    _last_wait_message: str | None = field(default=None, init=False)
    _shown: BatchInfo | None = field(default=None, init=False)

    def run(self) -> int:
        """0 when the source ran out or the operator stopped; 3 when the station had to stop."""
        self.say(
            f"Station {self.model_version}, {self.source.description}, sending to "
            f"{self.client.base_url}."
        )
        try:
            self.flush()
            while True:
                if self.source.remaining() == 0:
                    self.say("No more images to send.")
                    break
                batch = self.wait_for_batch()
                if not self.trigger.wait(self.check_in):
                    break
                current = self.recheck(self._shown or batch)
                if current is None:
                    continue
                frame = self.source.capture()
                if frame is None:
                    self.say("No more images to send.")
                    break
                self.capture(frame.data, frame.label, current)
                self.flush()
            return 0
        except StationStop as stop:
            self.say(str(stop))
            self.log.write("stopped", reason=str(stop))
            return 3
        except SourceError as error:
            self.say(str(error))
            self.log.write("stopped", reason=str(error))
            return 3
        finally:
            self.source.close()
            waiting = self.spool.count()
            if waiting:
                self.say(
                    f"{waiting} capture(s) are saved and waiting to send. They go out, in order, "
                    "the next time the station runs."
                )

    # ───────────── the batch ─────────────

    def wait_for_batch(self) -> BatchInfo:
        """Ask until a batch is at Preparation. Never captures while waiting."""
        while True:
            outcome = self.client.current_batch()
            if isinstance(outcome, BatchInfo):
                self._last_wait_message = None
                self._shown = outcome
                self.say(f"Next scan goes to {outcome.describe()}.")
                return outcome
            if isinstance(outcome, TokenRefused):
                raise StationStop(outcome.message)
            if isinstance(outcome, NoBatch):
                message = f"{outcome.message} Waiting..."
            else:
                message = (
                    f"Can't reach the app at {self.client.base_url} ({outcome.reason}). "
                    f"Trying again every {self.config.station.no_batch_wait_seconds:g} s."
                )
            if message != self._last_wait_message:  # say it once, not every few seconds
                self.say(message)
                self.log.write("waiting", reason=message)
                self._last_wait_message = message
            self.sleep(self.config.station.no_batch_wait_seconds)
            self.flush()

    def check_in(self) -> None:
        """While waiting for the key (D-054): ask the app for the batch again. The app records
        the token's use, so the Camera page shows the station as connected between captures,
        and the operator hears straight away when the batch changes."""
        outcome = self.client.current_batch()
        if isinstance(outcome, TokenRefused):
            raise StationStop(outcome.message)
        if isinstance(outcome, BatchInfo):
            self._last_wait_message = None
            if self._shown is None or outcome.batch_id != self._shown.batch_id:
                self.say(f"The batch changed. Next scan goes to {outcome.describe()}.")
            self._shown = outcome
            return
        message = (
            f"{outcome.message} The next press won't capture until a batch is at Preparation."
            if isinstance(outcome, NoBatch)
            else f"Can't reach the app at {self.client.base_url} ({outcome.reason})."
        )
        if message != self._last_wait_message:
            self.say(message)
            self.log.write("waiting", reason=message)
            self._last_wait_message = message

    def recheck(self, shown: BatchInfo) -> BatchInfo | None:
        """The batch can change while the operator waits; capture into the one current now."""
        outcome = self.client.current_batch()
        if isinstance(outcome, BatchInfo):
            if outcome.batch_id != shown.batch_id:
                self.say(f"The batch changed. This scan goes to {outcome.describe()}.")
            return outcome
        if isinstance(outcome, TokenRefused):
            raise StationStop(outcome.message)
        if isinstance(outcome, NoBatch):
            self.say(f"{outcome.message} Nothing was captured.")
            return None
        return shown  # the app didn't answer: keep the batch just shown; the spool covers sending

    # ───────────── one capture ─────────────

    def capture(self, data: bytes, label: str, batch: BatchInfo) -> None:
        captured_at = self.clock()
        capture_id = self.new_id()
        try:
            image, kind = sendable(data, quality=self.config.station.jpeg_quality)
        except ImageError as error:
            self.say(f"{label}: can't be sent, {error}")
            self.log.write("capture_refused", label=label, reason=str(error))
            return
        path = self.spool.create(captured_at, capture_id, image, kind)
        output = self.detector.detect(path)
        detections = map_detections(output.detections, self.detector.names, self.config.mapper)
        fields = build_fields(
            detections,
            self.model_version,
            self.config.station.scan_source,
            captured_at,
            capture_id=capture_id,
            batch_id=batch.batch_id,
        )
        self.spool.complete(
            path,
            {
                "fields": fields,
                "label": label,
                "batchCode": batch.batch_code,
                "inferenceMs": round(output.inference_ms, 1),
                "found": describe_detections(detections),
            },
        )
        self.log.write(
            "captured",
            captureId=capture_id,
            label=label,
            batch=batch.batch_code,
            detections=[d.to_contract() for d in detections],
            inferenceMs=round(output.inference_ms, 1),
        )

    # ───────────── sending ─────────────

    def flush(self) -> None:
        """Send every saved capture, oldest first. Stop at the first one that must wait."""
        for entry in self.spool.pending():
            outcome = self.client.send(
                entry.fields, entry.image.read_bytes(), entry.image.name, entry.mime
            )
            self._log_send(entry, outcome)
            if isinstance(outcome, Sent):
                self.spool.remove(entry)
                repeat = " (the app already had it)" if outcome.duplicate else ""
                self.say(
                    f"{entry.label}: {outcome.batch_code} section {outcome.sequence}, "
                    f"{outcome.verdict} ({entry.record.get('found', '')}){repeat}"
                )
            elif isinstance(outcome, Rejected):
                where = self.spool.fail(entry, outcome.message)
                self.say(f"{entry.label}: the app refused it: {outcome.message} Kept in {where}.")
            elif isinstance(outcome, TokenRefused):
                raise StationStop(outcome.message)
            elif isinstance(outcome, NoBatch):
                self.say(f"{entry.label}: {outcome.message} It's saved and will be sent later.")
                return
            else:
                self.say(
                    f"{entry.label}: couldn't send it ({outcome.reason}) after "
                    f"{outcome.attempts} tries. It's saved; {self.spool.count()} waiting to send, "
                    "in order."
                )
                return

    def _log_send(self, entry: Entry, outcome: object) -> None:
        common = {
            "captureId": entry.fields.get("captureId"),
            "label": entry.label,
            "batch": entry.batch_code,
        }
        if isinstance(outcome, Sent):
            self.log.write(
                "sent",
                **common,
                httpStatus=outcome.http_status,
                attempts=outcome.attempts,
                sequence=outcome.sequence,
                verdict=outcome.verdict,
                duplicate=outcome.duplicate,
            )
        elif isinstance(outcome, RetryLater):
            self.log.write(
                "send_failed",
                **common,
                httpStatus=outcome.http_status,
                attempts=outcome.attempts,
                reason=outcome.reason,
            )
        elif isinstance(outcome, Rejected | NoBatch | TokenRefused):
            self.log.write(
                "send_refused",
                **common,
                httpStatus=outcome.http_status,
                attempts=outcome.attempts,
                reason=outcome.message,
            )
