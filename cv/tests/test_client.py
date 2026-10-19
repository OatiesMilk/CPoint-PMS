import pytest
from fakes import JPEG, NO_BATCH_MESSAGE, TOKEN, FakeTransport, batch_ok, created, error, no_batch

from cpoint_cv.client import (
    TOKEN_REFUSED,
    BatchInfo,
    NoBatch,
    Rejected,
    RetryLater,
    ScanClient,
    Sent,
    TokenRefused,
)
from cpoint_cv.retry import Backoff
from cpoint_cv.transport import HttpResponse, TransportError

FIELDS = {
    "detections": "[]",
    "modelVersion": "yolo-v1-1d729fb0",
    "source": "WEBCAM",
    "capturedAt": "2026-10-19T09:30:00+08:00",
    "captureId": "0199f0a1-7c2e-4a51-9d3f-2b8c4e6a1f00",
    "batchId": "0199e2b4-1f00-7c3a-8d21-5e6f7a8b9c0d",
}


def client(transport: FakeTransport, sleeps: list[float] | None = None) -> ScanClient:
    log = sleeps if sleeps is not None else []
    return ScanClient(
        "http://localhost:3000/",
        TOKEN,
        transport,
        backoff=Backoff(attempts=4, base_seconds=1, max_seconds=15),
        sleep=log.append,
        rand=lambda: 1.0,  # no jitter: the full wait
    )


def send(c: ScanClient, fields: dict[str, str] = FIELDS) -> object:
    return c.send(fields, JPEG, "image.jpg", "image/jpeg")


class TestCurrentBatch:
    def test_reads_the_batch_and_sends_the_token(self) -> None:
        t = FakeTransport(current=[batch_ok()])
        batch = client(t).current_batch()
        assert batch == BatchInfo(
            "0199e2b4-1f00-7c3a-8d21-5e6f7a8b9c0d", "B-2026-0007", "LR-0042", "School Shoe"
        )
        assert isinstance(batch, BatchInfo)
        assert batch.describe() == "B-2026-0007 (roll LR-0042, School Shoe)"
        assert t.requests[0].url == "http://localhost:3000/api/v1/batches/current"
        assert t.requests[0].headers["Authorization"] == f"Bearer {TOKEN}"

    def test_no_batch_carries_the_apps_message(self) -> None:
        assert client(FakeTransport(current=[no_batch()])).current_batch() == NoBatch(
            NO_BATCH_MESSAGE, 404
        )

    def test_a_refused_token_says_what_to_do(self) -> None:
        t = FakeTransport(current=[error(401, "UNAUTHENTICATED", "That token isn't valid.")])
        assert client(t).current_batch() == TokenRefused(TOKEN_REFUSED, 401)

    def test_no_answer_is_retry_later(self) -> None:
        t = FakeTransport(current=[TransportError("connection refused")])
        assert client(t).current_batch() == RetryLater("connection refused", attempts=1)


class TestSend:
    def test_posts_multipart_with_every_field_and_the_image(self) -> None:
        t = FakeTransport(scans=[created()])
        outcome = send(client(t))
        assert outcome == Sent("scan-3", "B-2026-0007", 3, "REWORK", "DECIDED", False, 1, 201)
        post = t.posts()[0]
        assert post.url == "http://localhost:3000/api/v1/scans"
        assert post.headers["Authorization"] == f"Bearer {TOKEN}"
        assert post.form() == FIELDS
        assert post.body is not None and JPEG in post.body
        assert b'name="image"; filename="image.jpg"' in post.body
        assert b"Content-Type: image/jpeg" in post.body

    def test_a_repeat_is_reported_as_already_received(self) -> None:
        outcome = send(client(FakeTransport(scans=[created(duplicate=True)])))
        assert isinstance(outcome, Sent) and outcome.duplicate and outcome.http_status == 200

    def test_401_stops_without_retrying(self) -> None:
        sleeps: list[float] = []
        t = FakeTransport(scans=[error(401, "UNAUTHENTICATED", "That token isn't valid.")])
        assert send(client(t, sleeps)) == TokenRefused(TOKEN_REFUSED, 401)
        assert len(t.posts()) == 1 and sleeps == []

    def test_403_names_the_missing_scope(self) -> None:
        t = FakeTransport(scans=[error(403, "FORBIDDEN", "This device token can't scans create.")])
        outcome = send(client(t))
        assert isinstance(outcome, TokenRefused)
        assert "scans:create scope" in outcome.message

    def test_422_is_rejected_with_the_field_the_app_named(self) -> None:
        details = [{"path": ["image"], "message": "The image must be a JPEG, PNG or WebP file."}]
        t = FakeTransport(scans=[error(422, "VALIDATION", "Check the fields.", details)])
        outcome = send(client(t))
        assert outcome == Rejected(
            "Check the fields. (image: The image must be a JPEG, PNG or WebP file.)", 422
        )
        assert len(t.posts()) == 1

    def test_413_is_rejected(self) -> None:
        t = FakeTransport(
            scans=[error(413, "PAYLOAD_TOO_LARGE", "The image is larger than 10 MB.")]
        )
        assert send(client(t)) == Rejected("The image is larger than 10 MB.", 413)

    def test_409_for_a_pinned_batch_is_rejected(self) -> None:
        message = "That batch isn't in progress at Preparation, so it can't receive scans."
        t = FakeTransport(scans=[error(409, "CONFLICT", message)])
        assert send(client(t)) == Rejected(message, 409)

    def test_409_without_a_batch_means_no_batch(self) -> None:
        t = FakeTransport(scans=[error(409, "CONFLICT", NO_BATCH_MESSAGE)])
        fields = {k: v for k, v in FIELDS.items() if k != "batchId"}
        assert send(client(t), fields) == NoBatch(NO_BATCH_MESSAGE, 409)

    def test_server_errors_are_retried_with_backoff_then_succeed(self) -> None:
        sleeps: list[float] = []
        t = FakeTransport(
            scans=[error(503, "UNAVAILABLE", "Down"), TransportError("timed out"), created()]
        )
        outcome = send(client(t, sleeps))
        assert isinstance(outcome, Sent) and outcome.attempts == 3
        assert sleeps == [1, 2]
        # Every attempt carries the same captureId, so the app can't make two scans of it.
        assert {p.form()["captureId"] for p in t.posts()} == {FIELDS["captureId"]}

    def test_gives_up_after_every_attempt(self) -> None:
        sleeps: list[float] = []
        t = FakeTransport(scans=[TransportError("connection refused")])
        assert send(client(t, sleeps)) == RetryLater("connection refused", attempts=4)
        assert len(t.posts()) == 4 and sleeps == [1, 2, 4]

    def test_a_server_error_body_that_isnt_json_still_reads(self) -> None:
        t = FakeTransport(scans=[HttpResponse(502, b"<html>Bad gateway</html>")])
        assert send(client(t)) == RetryLater("HTTP 502", attempts=4, http_status=502)


def test_the_token_never_shows_in_repr() -> None:
    c = client(FakeTransport())
    assert TOKEN not in repr(c)
    assert "hidden" in repr(c)


@pytest.mark.parametrize("status", [200, 201])
def test_success_statuses(status: int) -> None:
    response = created(duplicate=status == 200)
    assert isinstance(send(client(FakeTransport(scans=[response]))), Sent)
