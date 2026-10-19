"""The station's secret and server address: ``CV_DEVICE_TOKEN`` and ``CV_BASE_URL``.

They're the same names the app's simulator uses. Each comes from the environment or, when it isn't
set there, from ``cv/.env`` (git-ignored). The token is never printed or logged.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from pathlib import Path

from .config import CV_DIR

TOKEN_VAR = "CV_DEVICE_TOKEN"
BASE_URL_VAR = "CV_BASE_URL"
ENV_FILE = CV_DIR / ".env"


def read_env_file(path: Path) -> dict[str, str]:
    """``KEY=value`` lines; blank lines and ``#`` comments are skipped, quotes are removed."""
    if not path.is_file():
        return {}
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip().removeprefix("export ").strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values[key] = value
    return values


def station_env(
    environ: Mapping[str, str] | None = None, env_file: Path = ENV_FILE
) -> dict[str, str]:
    """``cv/.env`` first, then the environment on top, so a variable set in the shell wins."""
    merged = read_env_file(env_file)
    for key, value in (os.environ if environ is None else environ).items():
        if value.strip():
            merged[key] = value
    return merged
