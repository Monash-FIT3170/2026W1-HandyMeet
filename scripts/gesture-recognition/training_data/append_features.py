#!/usr/bin/env python3
# pyright: basic
"""Append engineered geometric features to landmark rows.

Reads 02_hand_landmarks_mirrored.csv (gesture + 126 landmark coords),
appends per-hand engineered features (no palm normal), writes
03_training_data.csv.
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path

import numpy as np

ROOT_DIR = Path(__file__).resolve().parent
INPUT_CSV = ROOT_DIR / "02_training_data" / "02_hand_landmarks_mirrored.csv"
OUTPUT_CSV = ROOT_DIR / "02_training_data" / "03_training_data.csv"

_LANDMARK_COUNT = 21
_COORDS_PER_LANDMARK = 3
HAND_LANDMARK_COUNT = _LANDMARK_COUNT * _COORDS_PER_LANDMARK  # 63

# MediaPipe landmark indices
WRIST = 0
THUMB_TIP = 4
INDEX_TIP = 8
MIDDLE_MCP = 9
MIDDLE_TIP = 12
RING_TIP = 16
PINKY_TIP = 20

_FINGER_NAMES = ("thumb", "index", "middle", "ring", "pinky")
_FINGER_TIPS = (THUMB_TIP, INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP)

HAND_ENGINEERED_COUNT = 10
GLOBAL_FEATURES_SENTINEL = 10.0

_FINGERTIP_DIST_NAMES = [
    f"{_FINGER_NAMES[i]}_{_FINGER_NAMES[j]}_dist"
    for i in range(5)
    for j in range(i + 1, 5)
]
_ENGINEERED_NAMES = _FINGERTIP_DIST_NAMES
_OPPOSITE_HAND_FINGERTIP_DIST_NAMES = [
    f"left_{_FINGER_NAMES[i]}_right_{_FINGER_NAMES[j]}_dist"
    for i in range(5)
    for j in range(5)
]
_GLOBAL_FEATURE_NAMES = ["hands_distance", *_OPPOSITE_HAND_FINGERTIP_DIST_NAMES]

_COLUMNS_IN = 1 + HAND_LANDMARK_COUNT * 2  # 127


# ---------------------------------------------------------------------------
# Array-based geometry helpers
# ---------------------------------------------------------------------------


def _row(arr: np.ndarray, idx: int) -> np.ndarray:
    return arr[idx]


def _palm_center(arr: np.ndarray) -> np.ndarray:
    """Midpoint of wrist and middle MCP as palm centre proxy."""
    return (_row(arr, WRIST) + _row(arr, MIDDLE_MCP)) / 2.0


# ---------------------------------------------------------------------------
# Engineered feature extraction
# ---------------------------------------------------------------------------


def _extract_fingertip_distances(arr: np.ndarray) -> list[float]:
    """Distances in scale-normalised units (scale=1.0)."""
    dists: list[float] = []
    for i in range(len(_FINGER_TIPS)):
        for j in range(i + 1, len(_FINGER_TIPS)):
            d = float(
                np.linalg.norm(_row(arr, _FINGER_TIPS[i]) - _row(arr, _FINGER_TIPS[j]))
            )
            dists.append(d)
    return dists


def extract_engineered(arr: np.ndarray) -> list[float]:
    features: list[float] = []
    features.extend(_extract_fingertip_distances(arr))
    return features


def _extract_opposite_hand_fingertip_distances(
    left_lm: np.ndarray, right_lm: np.ndarray
) -> list[float]:
    res: list[float] = []
    for i in range(len(_FINGER_TIPS)):
        for j in range(len(_FINGER_TIPS)):
            dist = float(
                np.linalg.norm(
                    _row(left_lm, _FINGER_TIPS[i]) - _row(right_lm, _FINGER_TIPS[j])
                )
            )
            res.append(dist)
    return res


def _compute_hands_distance(left_arr: np.ndarray, right_arr: np.ndarray) -> float:
    return float(np.linalg.norm(_palm_center(left_arr) - _palm_center(right_arr)))


# ---------------------------------------------------------------------------
# Row processing
# ---------------------------------------------------------------------------


def _floats_to_array(flat: list[float]) -> np.ndarray:
    return np.array(flat, dtype=np.float64).reshape(
        _LANDMARK_COUNT, _COORDS_PER_LANDMARK
    )


def _is_zero_block(block: list[float]) -> bool:
    return all(v == 0.0 for v in block)


_ZERO_ENGINEERED = [0.0] * HAND_ENGINEERED_COUNT


def process_row(features: list[float]) -> list[float]:
    left_lm = features[:HAND_LANDMARK_COUNT]
    right_lm = features[HAND_LANDMARK_COUNT:]

    result = list(features)
    left_present = not _is_zero_block(left_lm)
    right_present = not _is_zero_block(right_lm)

    left_lm_arr = _floats_to_array(left_lm)
    right_lm_arr = _floats_to_array(right_lm)

    result.extend(extract_engineered(left_lm_arr) if left_present else _ZERO_ENGINEERED)
    result.extend(
        extract_engineered(right_lm_arr) if right_present else _ZERO_ENGINEERED
    )

    if left_present and right_present:
        hands_dist = _compute_hands_distance(left_lm_arr, right_lm_arr)
        opposite_fingertip_dist = _extract_opposite_hand_fingertip_distances(
            left_lm_arr, right_lm_arr
        )
        global_feature_values = [hands_dist, *opposite_fingertip_dist]
    else:
        global_feature_values = [GLOBAL_FEATURES_SENTINEL] * len(_GLOBAL_FEATURE_NAMES)
    result.extend(global_feature_values)

    return result


def build_header(landmark_header: list[str]) -> list[str]:
    header = list(landmark_header)
    for hand_name in ("left", "right"):
        for name in _ENGINEERED_NAMES:
            header.append(f"{hand_name}_{name}")
    header.extend(_GLOBAL_FEATURE_NAMES)
    return header


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> int:
    if not INPUT_CSV.exists():
        print(f"CSV not found: {INPUT_CSV}", file=sys.stderr)
        return 1

    with INPUT_CSV.open(newline="") as input_file:
        reader = csv.reader(input_file)
        landmark_header = next(reader, None)
        if not landmark_header:
            print(f"CSV is empty: {INPUT_CSV}", file=sys.stderr)
            return 1
        rows = list(reader)

    with OUTPUT_CSV.open("w", newline="") as output_file:
        writer = csv.writer(output_file)
        headers = build_header(landmark_header)
        expected_feature_count = len(headers) - 1
        writer.writerow(headers)
        written_rows = 0
        for row_number, row in enumerate(rows, start=2):
            if not row:
                continue
            if len(row) != _COLUMNS_IN:
                print(
                    f"Skipping row {row_number}: expected {_COLUMNS_IN} columns, "
                    f"found {len(row)}",
                    file=sys.stderr,
                )
                continue
            label = row[0].strip()
            features = [float(value) for value in row[1:]]
            processed = process_row(features)
            if len(processed) != expected_feature_count:
                raise ValueError(
                    f"Row {row_number} has {len(processed)} features. Expected {expected_feature_count}."
                )
            writer.writerow([label, *processed])
            written_rows += 1

    print(f"Wrote {written_rows} rows to {OUTPUT_CSV}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
