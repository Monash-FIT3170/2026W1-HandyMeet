#!/usr/bin/env python3
from __future__ import annotations

import csv
import math
import sys
from pathlib import Path

try:
    import cv2
    import mediapipe as mp
except ModuleNotFoundError as exc:
    print(
        "Missing dependency. Ensure all dependencies are installed:\n"
        "  uv pip install -r requirements.txt",
        file=sys.stderr,
    )
    raise SystemExit(1) from exc


ROOT_DIR = Path(__file__).resolve().parent
IMAGES_DIR = ROOT_DIR / "01_images"
OUTPUT_DIR = ROOT_DIR / "02_training_data"
OUTPUT_CSV = OUTPUT_DIR / "hand_landmarks.csv"
MODEL_PATH = ROOT_DIR / "hand_landmarker.task"


def get_gesture_name(image_path: Path) -> str:
    suffix = image_path.stem.rsplit("_", 1)
    if len(suffix) != 2:
        raise ValueError(
            f"Image name must match '<gesture_name>_NNN.png': {image_path.name}"
        )

    gesture_name = suffix[0]
    parent_gesture_name = image_path.parent.name

    if parent_gesture_name != gesture_name:
        raise ValueError(
            "Image path must match '01_images/<gesture>/<gesture>_NNN.png': "
            f"{image_path}"
        )

    return gesture_name


def build_header() -> list[str]:
    header = ["gesture"]
    for idx in range(21):
        header.extend([f"x{idx}", f"y{idx}", f"z{idx}"])
    return header


def get_scale(landmarks: list[object]) -> float:
    wrist = landmarks[0]
    middle_finger_base = landmarks[9]

    dx = middle_finger_base.x - wrist.x
    dy = middle_finger_base.y - wrist.y
    dz = middle_finger_base.z - wrist.z
    scale = math.sqrt((dx * dx) + (dy * dy) + (dz * dz))

    if scale == 0:
        raise ValueError("Scale is zero for wrist-to-middle-finger-base distance")

    return scale


def extract_row(image_path: Path, hands: object) -> list[float] | None:
    image = cv2.imread(str(image_path))
    if image is None:
        print(f"Skipping unreadable image: {image_path.name}", file=sys.stderr)
        return None

    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)
    results = hands.detect(mp_image)

    if not results.hand_landmarks:
        print(f"Skipping {image_path.name}: no hand detected", file=sys.stderr)
        return None

    landmarks = results.hand_landmarks[0]
    wrist = landmarks[0]
    scale = get_scale(landmarks)
    gesture_name = get_gesture_name(image_path)

    row: list[float | str] = [gesture_name]
    for landmark in landmarks:
        row.extend(
            [
                (landmark.x - wrist.x) / scale,
                (landmark.y - wrist.y) / scale,
                (landmark.z - wrist.z) / scale,
            ]
        )

    return row


def main() -> int:
    if not IMAGES_DIR.exists():
        print(f"Input directory does not exist: {IMAGES_DIR}", file=sys.stderr)
        return 1

    image_paths = sorted(IMAGES_DIR.glob("*/*.png"))
    if not image_paths:
        print(
            f"No PNG images found in gesture folders under {IMAGES_DIR}",
            file=sys.stderr,
        )
        return 1

    if not MODEL_PATH.exists():
        print(
            f"Hand Landmarker model not found: {MODEL_PATH}\n"
            "Download the MediaPipe Hand Landmarker task model and place it at "
            f"{MODEL_PATH}",
            file=sys.stderr,
        )
        return 1

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    base_options = mp.tasks.BaseOptions(model_asset_path=str(MODEL_PATH))
    options = mp.tasks.vision.HandLandmarkerOptions(
        base_options=base_options,
        num_hands=1,
        min_hand_detection_confidence=0.5,
        min_hand_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    written_rows = 0

    with (
        mp.tasks.vision.HandLandmarker.create_from_options(options) as hands,
        OUTPUT_CSV.open("a", newline="") as csv_file,
    ):
        writer = csv.writer(csv_file)

        if OUTPUT_CSV.stat().st_size == 0:
            writer.writerow(build_header())

        for image_path in image_paths:
            try:
                row = extract_row(image_path, hands)
            except ValueError as exc:
                print(f"Skipping {image_path.name}: {exc}", file=sys.stderr)
                continue

            if row is None:
                continue

            writer.writerow(row)
            written_rows += 1

    print(f"Appended {written_rows} rows to {OUTPUT_CSV}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
