#!/usr/bin/env python3
"""Mirror landmark rows to double the dataset.

Normalisation rules:
- Right-hand-only → right wrist at (0,0,0)
- Left-hand-only or two-hand → left wrist at (0,0,0)
"""
from __future__ import annotations

import csv
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
INPUT_CSV = ROOT_DIR / "02_training_data" / "01_hand_landmarks.csv"
OUTPUT_CSV = ROOT_DIR / "02_training_data" / "02_hand_landmarks_mirrored.csv"

HAND_LANDMARK_COUNT = 21 * 3
_COLUMNS_PER_ROW = 1 + HAND_LANDMARK_COUNT * 2  # 127


def _is_zero_block(block: list[float]) -> bool:
    return all(v == 0.0 for v in block)


def _mirror_landmarks(block: list[float]) -> list[float]:
    """Negate x coordinates."""
    mirrored = block[:]
    for i in range(0, len(mirrored), 3):
        mirrored[i] = -mirrored[i]
    return mirrored


def _reanchor_to_origin(block: list[float]) -> list[float]:
    """Subtract wrist coordinates so wrist lands at origin."""
    wrist_x, wrist_y, wrist_z = block[0], block[1], block[2]
    result: list[float] = []
    for i in range(0, len(block), 3):
        result.extend(
            [block[i] - wrist_x, block[i + 1] - wrist_y, block[i + 2] - wrist_z]
        )
    return result


_ZERO_LANDMARKS = [0.0] * HAND_LANDMARK_COUNT


def mirror_row(features: list[float]) -> list[float]:
    """Build a mirrored copy with correct wrist anchoring."""
    left_lm = features[:HAND_LANDMARK_COUNT]
    right_lm = features[HAND_LANDMARK_COUNT:]

    left_present = not _is_zero_block(left_lm)
    right_present = not _is_zero_block(right_lm)

    if left_present and right_present:
        right_at_origin = _reanchor_to_origin(right_lm)
        new_left_lm = _mirror_landmarks(right_at_origin)

        rx, ry, rz = right_lm[0], right_lm[1], right_lm[2]
        new_right_lm: list[float] = []
        for i in range(0, len(left_lm), 3):
            new_right_lm.extend(
                [rx - left_lm[i], left_lm[i + 1] - ry, left_lm[i + 2] - rz]
            )
        return new_left_lm + new_right_lm

    if left_present:
        new_right_lm = _mirror_landmarks(left_lm)
        return _ZERO_LANDMARKS + new_right_lm

    if right_present:
        right_at_origin = _reanchor_to_origin(right_lm)
        new_left_lm = _mirror_landmarks(right_at_origin)
        return new_left_lm + _ZERO_LANDMARKS

    return _ZERO_LANDMARKS + _ZERO_LANDMARKS


def main() -> int:
    if not INPUT_CSV.exists():
        print(f"CSV not found: {INPUT_CSV}", file=sys.stderr)
        return 1

    with INPUT_CSV.open(newline="") as input_file:
        reader = csv.reader(input_file)
        header = next(reader, None)
        if not header:
            print(f"CSV is empty: {INPUT_CSV}", file=sys.stderr)
            return 1
        rows = list(reader)

    with OUTPUT_CSV.open("w", newline="") as output_file:
        writer = csv.writer(output_file)
        writer.writerow(header)
        written_rows = 0
        for row_number, row in enumerate(rows, start=2):
            if not row:
                continue
            if len(row) != _COLUMNS_PER_ROW:
                print(
                    f"Skipping row {row_number}: expected {_COLUMNS_PER_ROW} columns, "
                    f"found {len(row)}",
                    file=sys.stderr,
                )
                continue
            label = row[0].strip()
            features = [float(value) for value in row[1:]]
            writer.writerow([label, *features])
            writer.writerow([label, *mirror_row(features)])
            written_rows += 2

    print(f"Wrote {written_rows} rows to {OUTPUT_CSV}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
