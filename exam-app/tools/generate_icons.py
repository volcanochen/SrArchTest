#!/usr/bin/env python3
"""Generate PWA icons (PNG) for the exam app without third-party dependencies.

Run:  python exam-app/tools/generate_icons.py
"""
from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "icons"

BG_TOP = (79, 70, 229)     # #4f46e5
BG_BOTTOM = (6, 182, 212)  # #06b6d4
FG = (255, 255, 255)

# 5x7 bitmap font, only glyphs needed for the "SA" wordmark.
FONT = {
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
}


def mix(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def rounded_alpha(x: float, y: float, size: int, radius_ratio: float) -> float:
    radius = size * radius_ratio
    left, top, right, bottom = 0.0, 0.0, float(size - 1), float(size - 1)
    if x < radius and y < radius:
        return _corner(x, y, radius, radius)
    if x > right - radius and y < radius:
        return _corner(right - x, y, radius, radius)
    if x < radius and y > bottom - radius:
        return _corner(x, bottom - y, radius, radius)
    if x > right - radius and y > bottom - radius:
        return _corner(right - x, bottom - y, radius, radius)
    return 1.0


def _corner(dx: float, dy: float, cx: float, cy: float) -> float:
    distance = math.hypot(cx - dx, cy - dy)
    if distance <= cx:
        return 1.0
    if distance >= cx + 1.0:
        return 0.0
    return max(0.0, min(1.0, cx + 1.0 - distance))


def glyph_map(text: str, glyph_height: int) -> list[list[int]]:
    scale = glyph_height / 7.0
    glyph_width = int(round(5 * scale))
    gap = max(1, int(round(glyph_width * 0.28)))
    rows: list[list[int]] = [[0] * (len(text) * glyph_width + (len(text) - 1) * gap) for _ in range(glyph_height)]
    cursor = 0
    for char in text:
        pattern = FONT[char]
        for gy in range(glyph_height):
            row = pattern[min(6, int(gy / scale))]
            for gx in range(glyph_width):
                if row[min(4, int(gx / scale))] == "1":
                    rows[gy][cursor + gx] = 1
        cursor += glyph_width + gap
    return rows


def render(size: int, text: str, radius_ratio: float, wordmark_ratio: float, safe_ratio: float) -> bytes:
    safe = int(size * (1.0 - safe_ratio))
    glyph_height = max(7, int(safe * wordmark_ratio))
    glyph = glyph_map(text, glyph_height)
    glyph_w, glyph_h = len(glyph[0]), len(glyph)
    start_x = (size - glyph_w) // 2
    start_y = (size - glyph_h) // 2

    raw = bytearray()
    for y in range(size):
        raw.append(0)  # PNG filter type 0
        for x in range(size):
            alpha = rounded_alpha(float(x), float(y), size, radius_ratio)
            if alpha <= 0:
                raw.extend((0, 0, 0, 0))
                continue
            bg = mix(BG_TOP, BG_BOTTOM, y / max(1, size - 1))
            color = bg
            gx, gy = x - start_x, y - start_y
            if 0 <= gx < glyph_w and 0 <= gy < glyph_h and glyph[gy][gx]:
                color = FG
            raw.extend((color[0], color[1], color[2], int(round(alpha * 255))))
    return bytes(raw)


def write_png(path: Path, size: int, raw: bytes) -> None:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    header = struct.pack(">2I5B", size, size, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    targets = {
        "icon-192.png": (192, 1.0 / 5.0, 0.0),
        "icon-512.png": (512, 1.0 / 5.0, 0.0),
        "maskable-512.png": (512, 1.0 / 4.0, 0.35),
    }
    for name, (size, wordmark_ratio, safe_ratio) in targets.items():
        radius_ratio = 0.0 if name.startswith("maskable") else 0.22
        raw = render(size, "SA", radius_ratio, wordmark_ratio, safe_ratio)
        write_png(OUT_DIR / name, size, raw)
        print(f"wrote {OUT_DIR / name} ({size}x{size})")


if __name__ == "__main__":
    main()
