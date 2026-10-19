"""What starts each capture: a key press at the webcam, or a timer for folder replay.

While the webcam station waits for a key, it calls ``idle`` every ``idle_seconds`` so it can
check in with the app (D-054): the Camera page then shows the station as connected between
captures, and the operator hears at once if someone changed the batch.
"""

from __future__ import annotations

import queue
import sys
import time
from collections.abc import Callable
from typing import Protocol

Idle = Callable[[], None]


class Trigger(Protocol):
    def wait(self, idle: Idle | None = None) -> bool:
        """Block until the next capture. False means the operator asked to stop."""
        ...


class KeyTrigger:
    """Space captures one section, as a pedal or button would; Q stops. On consoles without
    single-key input (not Windows), Enter captures and q then Enter stops."""

    def __init__(
        self,
        say: Callable[[str], None] = print,
        idle_seconds: float = 20.0,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._say = say
        self._idle_seconds = idle_seconds
        self._clock = clock
        self._sleep = sleep

    def _due(self, since: float) -> bool:
        return self._idle_seconds > 0 and self._clock() - since >= self._idle_seconds

    def wait(self, idle: Idle | None = None) -> bool:
        if sys.platform == "win32":
            import msvcrt

            self._say("Press Space to capture this section, or Q to stop.")
            since = self._clock()
            while True:
                if msvcrt.kbhit():
                    key = msvcrt.getwch()
                    if key == " ":
                        return True
                    if key.lower() == "q" or key == "\x03":
                        return False
                    continue
                if idle is not None and self._due(since):
                    idle()
                    since = self._clock()
                self._sleep(0.05)
        self._say("Press Enter to capture this section, or type q and Enter to stop.")
        return self._wait_line(idle)

    def _wait_line(self, idle: Idle | None) -> bool:
        import select

        while True:
            timeout = self._idle_seconds if idle is not None and self._idle_seconds > 0 else None
            ready, _, _ = select.select([sys.stdin], [], [], timeout)
            if ready:
                line = sys.stdin.readline()
                return bool(line) and line.strip().lower() != "q"
            if idle is not None:
                idle()


class IntervalTrigger:
    """The first capture at once, then one every ``seconds``. Folder replay sends a scan at each
    step, which is its own check-in, so ``idle`` isn't needed."""

    def __init__(self, seconds: float, sleep: Callable[[float], None] = time.sleep) -> None:
        self._seconds = seconds
        self._sleep = sleep
        self._first = True

    def wait(self, idle: Idle | None = None) -> bool:
        if self._first:
            self._first = False
        else:
            self._sleep(self._seconds)
        return True


class ButtonTrigger:
    """The station window's Capture and Stop buttons (D-059). The window's thread calls
    ``press`` or ``stop``; the station's thread waits in ``wait`` and checks in with the app every
    ``idle_seconds`` meanwhile, as at the console. ``idle_seconds`` can change while it runs: the
    window asks more often while no batch is at Preparation, so Capture comes back quickly."""

    def __init__(self, idle_seconds: float = 20.0, clock: Callable[[], float] = time.monotonic):
        self.idle_seconds = idle_seconds
        self._clock = clock
        self._presses: queue.Queue[bool] = queue.Queue()

    def press(self) -> None:
        self._presses.put(True)

    def stop(self) -> None:
        self._presses.put(False)

    def wait(self, idle: Idle | None = None) -> bool:
        since = self._clock()
        while True:
            try:
                return self._presses.get(timeout=0.1)
            except queue.Empty:
                pass
            due = self.idle_seconds > 0 and self._clock() - since >= self.idle_seconds
            if idle is not None and due:
                idle()
                since = self._clock()
