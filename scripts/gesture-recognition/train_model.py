#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

import numpy as np
import numpy.typing as npt
from sklearn.model_selection import train_test_split

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
CSV_PATH = (
    ROOT_DIR / "training_data" / "02_training_data" / "03_training_data.csv"
)
MODEL_PATH = ROOT_DIR / "model.h5"
LABELS_PATH = ROOT_DIR / "model_labels.json"
EPOCHS = 200
BATCH_SIZE = 64


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

        cols = len(header)
        for row_number, row in enumerate(reader, start=2):
            if not row:
                continue
            if len(row) != cols:
                raise ValueError(f"Row {row_number} has an invalid dimension: {len(row)} cols, should be {cols}")

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

            tf.keras.layers.Dense(512, activation='relu'),
            tf.keras.layers.Dropout(0.2),
            tf.keras.layers.Dense(256, activation='relu'),
            tf.keras.layers.Dropout(0.2),
            tf.keras.layers.Dense(128, activation='relu'),
            tf.keras.layers.Dropout(0.2),

            tf.keras.layers.Dense(num_classes, activation="softmax"),
        ],
    )

    optimizer = tf.keras.optimizers.AdamW(learning_rate=3e-4, weight_decay=1e-4)

    model.compile(
        optimizer=optimizer,
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )

    return model


def main() -> int:
    try:
        x, y, class_names = load_training_data(CSV_PATH)
    except (FileNotFoundError, ValueError) as exc:
        print(exc, file=sys.stderr)
        return 1

    x_train, x_val, y_train, y_val = train_test_split(
        x, y, test_size=0.2, random_state=42, stratify=y
    )

    if x_train.shape[0] < BATCH_SIZE:
        batch_size = x_train.shape[0]
    else:
        batch_size = BATCH_SIZE

    model = build_model(x_train.shape[1], len(class_names))
    print(f"Training model from {CSV_PATH}")
    hist = model.fit(
        x_train,
        y_train,
        epochs=EPOCHS,
        batch_size=batch_size,
        shuffle=True,
        validation_data=(x_val, y_val),
        verbose=1,
        callbacks=[
            tf.keras.callbacks.ReduceLROnPlateau(
                monitor="val_loss",
                factor=0.5,
                patience=8,
                min_lr=1e-5,
                verbose=1,
            ),
            tf.keras.callbacks.EarlyStopping(
                monitor="val_loss",
                patience=25,
                restore_best_weights=True,
            ),
        ],
    )

    model.save(MODEL_PATH)
    LABELS_PATH.write_text(json.dumps(class_names, indent=2) + "\n")

    best_epoch = hist.history["val_loss"].index(min(hist.history["val_loss"])) + 1
    print(f"Training accuracy: {hist.history['accuracy'][-1]}")
    print(f"Validation accuracy: {hist.history['val_accuracy'][-1]}")
    print("Training loss:", hist.history["loss"][best_epoch - 1])
    print("Validation loss:", hist.history["val_loss"][best_epoch - 1])
    print()
    print(f"Saved model to {MODEL_PATH}")
    print(f"Saved labels to {LABELS_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
