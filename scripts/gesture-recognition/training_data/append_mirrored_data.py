#!/usr/bin/env python3
from __future__ import annotations

import csv
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent
INPUT_CSV = ROOT_DIR / "02_training_data" / "hand_landmarks.csv"
OUTPUT_CSV = ROOT_DIR / "02_training_data" / "training_data_with_mirrored.csv"
HAND_FEATURE_COUNT = 21 * 3


def is_zero_hand(block: list[float]) -> bool:
    return all(value == 0.0 for value in block)


def mirror_hand_in_place(block: list[float]) -> list[float]:
    mirrored = block[:]
    for index in range(0, len(mirrored), 3):
        mirrored[index] = -mirrored[index]
    return mirrored


def reanchor_hand(block: list[float], new_anchor: tuple[float, float, float]) -> list[float]:
    reanchored: list[float] = []
    anchor_x, anchor_y, anchor_z = new_anchor
    for index in range(0, len(block), 3):
        reanchored.extend(
            [
                block[index] - anchor_x,
                block[index + 1] - anchor_y,
                block[index + 2] - anchor_z,
            ]
        )
    return reanchored


def mirror_row(features: list[float]) -> list[float]:
    left_block = features[:HAND_FEATURE_COUNT]
    right_block = features[HAND_FEATURE_COUNT:]

    left_present = not is_zero_hand(left_block)
    right_present = not is_zero_hand(right_block)

    if left_present and right_present:
        right_wrist = (right_block[0], right_block[1], right_block[2])
        mirrored_left = mirror_hand_in_place(reanchor_hand(right_block, right_wrist))
        mirrored_right = mirror_hand_in_place(reanchor_hand(left_block, right_wrist))
        return mirrored_left + mirrored_right

    if left_present:
        return empty_hand_features() + mirror_hand_in_place(left_block)

    if right_present:
        right_wrist = (right_block[0], right_block[1], right_block[2])
        return (
            mirror_hand_in_place(reanchor_hand(right_block, right_wrist))
            + empty_hand_features()
        )

    return features[:]


def empty_hand_features() -> list[float]:
    return [0.0] * HAND_FEATURE_COUNT


def main() -> int:
    if not INPUT_CSV.exists():
        print(f"Training CSV not found: {INPUT_CSV}", file=sys.stderr)
        return 1

    with INPUT_CSV.open(newline="") as input_file:
        reader = csv.reader(input_file)
        header = next(reader, None)

        if not header:
            print(f"Training CSV is empty: {INPUT_CSV}", file=sys.stderr)
            return 1

        rows = list(reader)

    with OUTPUT_CSV.open("w", newline="") as output_file:
        writer = csv.writer(output_file)
        writer.writerow(header)

        written_rows = 0
        for row_number, row in enumerate(rows, start=2):
            if not row:
                continue

            if len(row) != 1 + (2 * HAND_FEATURE_COUNT):
                print(
                    f"Skipping row {row_number}: expected {1 + (2 * HAND_FEATURE_COUNT)} columns, "
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
