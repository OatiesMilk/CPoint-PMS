"""Bounded exponential backoff with jitter, for network errors and server errors (5xx)."""

from __future__ import annotations

import random
from collections.abc import Callable, Iterator
from dataclasses import dataclass


@dataclass(frozen=True)
class Backoff:
    """``attempts`` tries in all; the waits between them double from ``base_seconds`` up to
    ``max_seconds``, each shortened by a random amount (up to half) so stations don't retry in step.
    """

    attempts: int = 4
    base_seconds: float = 1.0
    max_seconds: float = 15.0

    def delays(self, rand: Callable[[], float] = random.random) -> Iterator[float]:
        """The waits before the 2nd, 3rd, … attempt: ``attempts - 1`` of them."""
        for i in range(self.attempts - 1):
            full = min(self.max_seconds, self.base_seconds * 2**i)
            yield full * (0.5 + 0.5 * rand())
