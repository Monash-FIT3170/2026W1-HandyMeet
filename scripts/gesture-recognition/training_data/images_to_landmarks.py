#!/usr/bin/env python3
from __future__ import annotations

import csv
import math
import sys
from pathlib import Path
from typing import TypeAlias

try:
    import cv2
    import mediapipe as mp
    from mediapipe.tasks.python.components.containers.category import Category
    from mediapipe.tasks.python.components.containers.landmark import NormalizedLandmark
    from mediapipe.tasks.python.vision.hand_landmarker import (
        HandLandmarker,
        HandLandmarkerResult,
    )
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
OUTPUT_CSV = OUTPUT_DIR / "01_hand_landmarks.csv"
MODEL_PATH = ROOT_DIR / "hand_landmarker.task"

HandLandmarks: TypeAlias = list[NormalizedLandmark]
HandAssignments: TypeAlias = dict[str, HandLandmarks]

HAND_LANDMARK_COUNT = 21 * 3


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
    for hand_name in ("left", "right"):
        for idx in range(21):
            header.extend(
                [f"{hand_name}_x{idx}", f"{hand_name}_y{idx}", f"{hand_name}_z{idx}"]
            )
    return header


def get_coordinate(value: float | None, axis_name: str) -> float:
    if value is None:
        raise ValueError(f"Missing landmark {axis_name} coordinate")
    return value


def get_scale(landmarks: HandLandmarks) -> float:
    wrist = landmarks[0]
    middle_finger_base = landmarks[9]
    dx = get_coordinate(middle_finger_base.x, "x") - get_coordinate(wrist.x, "x")
    dy = get_coordinate(middle_finger_base.y, "y") - get_coordinate(wrist.y, "y")
    dz = get_coordinate(middle_finger_base.z, "z") - get_coordinate(wrist.z, "z")
    scale = math.sqrt((dx * dx) + (dy * dy) + (dz * dz))
    if scale == 0:
        raise ValueError("Scale is zero for wrist-to-middle-finger-base distance")
    return scale


def empty_hand_features() -> list[float]:
    return [0.0] * HAND_LANDMARK_COUNT


def get_primary_handedness_label(classifications: list[Category]) -> str | None:
    if not classifications:
        return None
    category = classifications[0]
    label = str(
        getattr(category, "category_name", "")
        or getattr(category, "display_name", "")
        or getattr(category, "label", "")
    )
    label = label.strip().lower()
    if label in {"left", "right"}:
        return label
    return None


def assign_hands(results: HandLandmarkerResult) -> HandAssignments:
    assigned: dict[str, tuple[float, HandLandmarks]] = {}
    unlabeled: list[HandLandmarks] = []
    handedness_results = list(getattr(results, "handedness", []))
    for index, landmarks in enumerate(results.hand_landmarks):
        classifications = handedness_results[index] if index < len(handedness_results) else []
        label = get_primary_handedness_label(classifications)
        score = float(classifications[0].score or 0.0) if classifications else 0.0
        if label is None:
            unlabeled.append(landmarks)
            continue
        current = assigned.get(label)
        if current is None or score > current[0]:
            assigned[label] = (score, landmarks)
    resolved = {label: landmarks for label, (_, landmarks) in assigned.items()}
    if unlabeled:
        remaining_labels = [label for label in ("left", "right") if label not in resolved]
        unlabeled.sort(key=lambda landmarks: landmarks[0].x)
        for label, landmarks in zip(remaining_labels, unlabeled):
            resolved[label] = landmarks
    return resolved


def encode_hand_features(
    landmarks: HandLandmarks,
    anchor_wrist: NormalizedLandmark,
    scale: float,
) -> list[float]:
    features: list[float] = []
    for landmark in landmarks:
        features.extend(
            [
                (get_coordinate(landmark.x, "x") - get_coordinate(anchor_wrist.x, "x"))
                / scale,
                (get_coordinate(landmark.y, "y") - get_coordinate(anchor_wrist.y, "y"))
                / scale,
                (get_coordinate(landmark.z, "z") - get_coordinate(anchor_wrist.z, "z"))
                / scale,
            ]
        )
    return features


def extract_row(image_path: Path, hands: HandLandmarker) -> list[str | float] | None:
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

    assigned_hands = assign_hands(results)
    left_landmarks = assigned_hands.get("left")
    right_landmarks = assigned_hands.get("right")

    if left_landmarks is not None:
        anchor_wrist = left_landmarks[0]
        scale = get_scale(left_landmarks)
    elif right_landmarks is not None:
        anchor_wrist = right_landmarks[0]
        scale = get_scale(right_landmarks)
    else:
        print(
            f"Skipping {image_path.name}: could not assign detected hands",
            file=sys.stderr,
        )
        return None

    gesture_name = get_gesture_name(image_path)

    row: list[str | float] = [gesture_name]
    row.extend(
        encode_hand_features(left_landmarks, anchor_wrist, scale)
        if left_landmarks is not None
        else empty_hand_features()
    )
    row.extend(
        encode_hand_features(right_landmarks, anchor_wrist, scale)
        if right_landmarks is not None
        else empty_hand_features()
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
        num_hands=2,
        min_hand_detection_confidence=0.5,
        min_hand_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    written_rows = 0

    with (
        mp.tasks.vision.HandLandmarker.create_from_options(options) as hands,
        OUTPUT_CSV.open("w", newline="") as csv_file,
    ):
        writer = csv.writer(csv_file)
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

    print(f"Wrote {written_rows} rows to {OUTPUT_CSV}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
