"""Which weights judged a scan: the file's SHA-256 and the ``modelVersion`` sent with it (D-049)."""

from __future__ import annotations

import hashlib
import re
from pathlib import Path

# The app stores modelVersion as text of at most 60 characters (scan.validator.ts).
MAX_MODEL_VERSION = 60
_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def model_version(name: str, sha256: str) -> str:
    """``<name>-<first 8 hex of the SHA-256>``, e.g. ``yolo-v1-1d729fb0``."""
    if not _NAME.match(name):
        raise ValueError(
            f"model name {name!r} must start with a letter or digit and use only letters, "
            "digits, '.', '_' or '-'."
        )
    if not re.fullmatch(r"[0-9a-f]{64}", sha256):
        raise ValueError("sha256 must be 64 lowercase hex digits.")
    version = f"{name}-{sha256[:8]}"
    if len(version) > MAX_MODEL_VERSION:
        raise ValueError(
            f"model name {name!r} is too long: the model version can be at most "
            f"{MAX_MODEL_VERSION} characters including the 9-character hash suffix."
        )
    return version
