#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

import numpy as np
import numpy.typing as npt

try:
    import tensorflow as tf
except ModuleNotFoundError as exc:
    print(
        "Missing dependency. Ensure all dependencies are installed:\n" +
        "  uv pip install -r requirements.txt",
        file=sys.stderr,
    )
    raise SystemExit(1) from exc


ROOT_DIR = Path(__file__).resolve().parent
MIRRORED_CSV_PATH = (
    ROOT_DIR / "training_data" / "02_training_data" / "training_data_with_mirrored.csv"
)
CSV_PATH = ROOT_DIR / "training_data" / "02_training_data" / "hand_landmarks.csv"
MODEL_PATH = ROOT_DIR / "model.h5"
LABELS_PATH = ROOT_DIR / "model_labels.json"
EPOCHS = 80
BATCH_SIZE = 32


def load_training_data(
    csv_path: Path,
) -> tuple[npt.NDArray[np.float32], npt.NDArray[np.int32], list[str]]:
    if not csv_path.exists():
        raise FileNotFoundError(f"Training CSV not found: {csv_path}")

    labels: list[str] = []
    features: list[list[float]] = []

    with csv_path.open(newline="") as csv_file:
        reader = csv.reader(csv_file)
        header = next(reader, None)

        if not header:
            raise ValueError(f"Training CSV is empty: {csv_path}")

        for row_number, row in enumerate(reader, start=2):
            if not row:
                continue

            if len(row) < 2:
                raise ValueError(f"Row {row_number} is incomplete: {row}")

            label = row[0].strip()
            if not label:
                raise ValueError(f"Row {row_number} has an empty gesture label")
            feature_row = [float(value) for value in row[1:]]
            labels.append(label)
            features.append(feature_row)

    if not features:
        raise ValueError(f"No training rows found in {csv_path}")

    x = np.asarray(features, dtype=np.float32)
    class_names = sorted(set(labels))
    label_to_index = {label: index for index, label in enumerate(class_names)}
    y = np.asarray([label_to_index[label] for label in labels], dtype=np.int32)

    return x, y, class_names


def build_model(input_dim: int, num_classes: int) -> tf.keras.Model:
    model = tf.keras.Sequential(
        [
            tf.keras.layers.Input(shape=(input_dim,)),
            tf.keras.layers.Dense(256),
            tf.keras.layers.BatchNormalization(),
            tf.keras.layers.ReLU(),
            tf.keras.layers.Dropout(0.2),
            tf.keras.layers.Dense(128, activation="relu"),
            tf.keras.layers.Dropout(0.2),
            tf.keras.layers.Dense(64, activation="relu"),
            tf.keras.layers.Dropout(0.2),
            tf.keras.layers.Dense(num_classes, activation="softmax"),
        ],
    )

    model.compile(
        optimizer="adam",
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )

    return model


def main() -> int:
    try:
        csv_path = MIRRORED_CSV_PATH if MIRRORED_CSV_PATH.exists() else CSV_PATH
        x_train, y_train, class_names = load_training_data(csv_path)
    except (FileNotFoundError, ValueError) as exc:
        print(exc, file=sys.stderr)
        return 1

    if x_train.shape[0] < BATCH_SIZE:
        batch_size = x_train.shape[0]
    else:
        batch_size = BATCH_SIZE

    model = build_model(x_train.shape[1], len(class_names))
    print(f"Training model from {csv_path}")
    _ = model.fit(
        x_train,
        y_train,
        epochs=EPOCHS,
        batch_size=batch_size,
        shuffle=True,
        verbose=1,
        callbacks=[
            tf.keras.callbacks.EarlyStopping(
                monitor="val_loss",
                patience=10,
                restore_best_weights=True,
            )
        ],
    )

    model.save(MODEL_PATH)
    LABELS_PATH.write_text(json.dumps(class_names, indent=2) + "\n")
    print(f"Saved model to {MODEL_PATH}")
    print(f"Saved labels to {LABELS_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
