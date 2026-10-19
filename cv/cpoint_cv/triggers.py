"""What starts each capture: a key press at the webcam, or a timer for folder replay."""

from __future__ import annotations

import sys
import time
from collections.abc import Callable
from typing import Protocol


class Trigger(Protocol):
    def wait(self) -> bool:
        """Block until the next capture. False means the operator asked to stop."""
        ...


class KeyTrigger:
    """Space captures one section, as a pedal or button would; Q stops. On consoles without
    single-key input (not Windows), Enter captures and q then Enter stops."""

    def __init__(self, say: Callable[[str], None] = print) -> None:
        self._say = say

    def wait(self) -> bool:
        if sys.platform == "win32":
            import msvcrt

            self._say("Press Space to capture this section, or Q to stop.")
            while True:
                key = msvcrt.getwch()
                if key == " ":
                    return True
                if key.lower() == "q" or key == "\x03":
                    return False
        self._say("Press Enter to capture this section, or type q and Enter to stop.")
        try:
            return input().strip().lower() != "q"
        except EOFError:
            return False


class IntervalTrigger:
    """The first capture at once, then one every ``seconds``."""

    def __init__(self, seconds: float, sleep: Callable[[float], None] = time.sleep) -> None:
        self._seconds = seconds
        self._sleep = sleep
        self._first = True

    def wait(self) -> bool:
        if self._first:
            self._first = False
        else:
            self._sleep(self._seconds)
        return True
