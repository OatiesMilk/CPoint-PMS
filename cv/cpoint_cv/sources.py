"""Where ``predict`` finds its photos: image files, or every image in a folder."""

from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def collect_images(paths: Sequence[Path]) -> list[Path]:
    """Images named directly, plus every image in a named folder (not its subfolders), sorted."""
    images: list[Path] = []
    for path in paths:
        if path.is_dir():
            images += sorted(p for p in path.iterdir() if p.suffix.lower() in IMAGE_SUFFIXES)
        elif path.is_file():
            images.append(path)
        else:
            raise FileNotFoundError(f"{path} isn't a file or folder.")
    return images
