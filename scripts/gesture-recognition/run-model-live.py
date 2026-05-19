#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import sys
import time
from pathlib import Path
from typing import TypedDict, TypeAlias

import cv2
import mediapipe as mp
import numpy as np
import numpy.typing as npt
import tensorflow as tf
from mediapipe.tasks.python.components.containers.category import Category
from mediapipe.tasks.python.components.containers.landmark import NormalizedLandmark
from mediapipe.tasks.python.vision.hand_landmarker import (
    HandLandmarker,
    HandLandmarkerResult,
)


ROOT_DIR = Path(__file__).resolve().parent
MODEL_PATH = ROOT_DIR / "model.h5"
LABELS_PATH = ROOT_DIR / "model_labels.json"
HAND_LANDMARKER_PATH = ROOT_DIR / "training_data" / "hand_landmarker.task"
SINGLE_HAND_CONFIDENCE_THRESHOLD = 0.9
TWO_HAND_PREFERENCE_THRESHOLD = 0.8
HAND_FEATURE_COUNT = 21 * 3

HandLandmarks: TypeAlias = list[NormalizedLandmark]
HandAssignments: TypeAlias = dict[str, HandLandmarks]


class PredictionCandidate(TypedDict):
    candidate_name: str
    gesture_name: str
    best_probability: float
    probabilities: npt.NDArray[np.float32]


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
    return [0.0] * HAND_FEATURE_COUNT


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


def build_feature_vector(
    left_landmarks: HandLandmarks | None,
    right_landmarks: HandLandmarks | None,
) -> npt.NDArray[np.float32]:
    if left_landmarks is not None:
        anchor_wrist = left_landmarks[0]
        scale = get_scale(left_landmarks)
    elif right_landmarks is not None:
        anchor_wrist = right_landmarks[0]
        scale = get_scale(right_landmarks)
    else:
        raise ValueError("At least one hand is required to build a feature vector")

    features: list[float] = []
    features.extend(
        encode_hand_features(left_landmarks, anchor_wrist, scale)
        if left_landmarks is not None
        else empty_hand_features()
    )
    features.extend(
        encode_hand_features(right_landmarks, anchor_wrist, scale)
        if right_landmarks is not None
        else empty_hand_features()
    )

    return np.asarray([features], dtype=np.float32)


def predict_candidate(
    model: tf.keras.Model,
    gesture_names: list[str],
    left_landmarks: HandLandmarks | None,
    right_landmarks: HandLandmarks | None,
    candidate_name: str,
) -> PredictionCandidate:
    features = build_feature_vector(left_landmarks, right_landmarks)
    probabilities = np.asarray(model.predict(features, verbose=0)[0], dtype=np.float32)
    best_index = int(np.argmax(probabilities))
    best_probability = float(probabilities[best_index])

    return {
        "candidate_name": candidate_name,
        "gesture_name": gesture_names[best_index],
        "best_probability": best_probability,
        "probabilities": probabilities,
    }


def load_gesture_names(labels_path: Path) -> list[str]:
    if not labels_path.exists():
        raise FileNotFoundError(f"Model labels not found: {labels_path}")

    class_names = json.loads(labels_path.read_text())
    if not isinstance(class_names, list) or not class_names:
        raise ValueError(f"Model labels file is invalid: {labels_path}")

    return [str(name) for name in class_names]


def format_probabilities(
    probabilities: npt.NDArray[np.float32], gesture_names: list[str]
) -> str:
    return ", ".join(
        f"{name}: {probability * 100:.1f}%"
        for name, probability in zip(gesture_names, probabilities)
    )


def main() -> int:
    if not MODEL_PATH.exists():
        print(f"Model not found: {MODEL_PATH}", file=sys.stderr)
        return 1

    try:
        gesture_names = load_gesture_names(LABELS_PATH)
    except (FileNotFoundError, ValueError) as exc:
        print(exc, file=sys.stderr)
        return 1

    if not HAND_LANDMARKER_PATH.exists():
        print(f"Hand Landmarker model not found: {HAND_LANDMARKER_PATH}", file=sys.stderr)
        return 1

    model = tf.keras.models.load_model(MODEL_PATH)
    if model.output_shape[-1] != len(gesture_names):
        print(
            "Model output size does not match saved labels: "
            f"{model.output_shape[-1]} outputs vs {len(gesture_names)} labels",
            file=sys.stderr,
        )
        return 1

    base_options = mp.tasks.BaseOptions(model_asset_path=str(HAND_LANDMARKER_PATH))
    options = mp.tasks.vision.HandLandmarkerOptions(
        base_options=base_options,
        num_hands=2,
        min_hand_detection_confidence=0.5,
        min_hand_presence_confidence=0.5,
        min_tracking_confidence=0.5,
        running_mode=mp.tasks.vision.RunningMode.IMAGE,
    )

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Could not open camera", file=sys.stderr)
        return 1

    last_output = ""
    try:
        with mp.tasks.vision.HandLandmarker.create_from_options(options) as hands:
            while True:
                ok, frame = cap.read()
                if not ok:
                    print("Failed to read frame from camera", file=sys.stderr)
                    return 1

                image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)
                results = hands.detect(mp_image)

                if not results.hand_landmarks:
                    output = "no gesture (no hand detected)"
                else:
                    detected_hand_count = len(results.hand_landmarks)
                    assigned_hands = assign_hands(results)
                    left_landmarks = assigned_hands.get("left")
                    right_landmarks = assigned_hands.get("right")
                    candidates: list[dict[str, object]] = []

                    try:
                        if left_landmarks is not None:
                            candidates.append(
                                predict_candidate(
                                    model,
                                    gesture_names,
                                    left_landmarks,
                                    None,
                                    "left-only",
                                )
                            )
                        if right_landmarks is not None:
                            candidates.append(
                                predict_candidate(
                                    model,
                                    gesture_names,
                                    None,
                                    right_landmarks,
                                    "right-only",
                                )
                            )
                        if (
                            detected_hand_count == 2
                            and left_landmarks is not None
                            and right_landmarks is not None
                        ):
                            candidates.append(
                                predict_candidate(
                                    model,
                                    gesture_names,
                                    left_landmarks,
                                    right_landmarks,
                                    "both-hands",
                                )
                            )
                    except ValueError:
                        output = "no gesture (invalid hand scale)"
                    else:
                        if not candidates:
                            output = "no gesture (could not assign detected hands)"
                        else:
                            two_hand_candidate = next(
                                (
                                    candidate
                                    for candidate in candidates
                                    if candidate["candidate_name"] == "both-hands"
                                ),
                                None,
                            )
                            if (
                                two_hand_candidate is not None
                                and two_hand_candidate["best_probability"]
                                >= TWO_HAND_PREFERENCE_THRESHOLD
                            ):
                                chosen = two_hand_candidate
                                acceptance_threshold = TWO_HAND_PREFERENCE_THRESHOLD
                            else:
                                chosen = max(
                                    candidates,
                                    key=lambda candidate: candidate["best_probability"],
                                )
                                acceptance_threshold = SINGLE_HAND_CONFIDENCE_THRESHOLD
                                if chosen["candidate_name"] == "both-hands":
                                    acceptance_threshold = TWO_HAND_PREFERENCE_THRESHOLD

                            if chosen["best_probability"] >= acceptance_threshold:
                                output = (
                                    f"{chosen['gesture_name']}: "
                                    f"{chosen['best_probability'] * 100:.1f}% "
                                    f"({chosen['candidate_name']})"
                                )
                            else:
                                output = (
                                    "no gesture "
                                    f"({format_probabilities(chosen['probabilities'], gesture_names)})"
                                )

                if output != last_output:
                    print(output)
                    last_output = output

                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

                time.sleep(0.02)
    finally:
        cap.release()
        cv2.destroyAllWindows()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
