# AI Gesture Recognition Model

This directory contains the scripts and data required to train the AI Gesture Recognition model.

## Creating Raw Training Data

Please keep in mind:

- for single-hand gestures ensure only one hand is in the frame
- make sure you're doing the gesture for the _entire_ video - any frames you aren't doing the gesture in will result in a poorer model
- while you should rotate and move a bit, make sure you're keeping the correct orientation for the gesture (e.g. help should have the back of the fist pointing towards the camera)

## Rules for Multi-Hand Inference

1. if only one hand in frame -> use one hand
2. if 2 hands detected:
   1. run inference 3 times - using each hand individually and both hands
   2. if both hands confidence > threshold, use that
   3. otherwise, use the highest confidence

A minimum confidence threshold must be met to classify a gesture to reduce the chances of closed set recognition.

## Instructions to Train the Model

1. Ensure you are in the virtual environment: `source .venv/bin/activate`
2. Generate the images from the raw videos: `uv run training_data/videos_to_frames.py`
3. Generate labelled Mediapipe landmark data from the images: `uv run training_data/images_to_landmarks.py`
4. Generate mirrored training data to allow both hands: `uv run training_data/append_mirrored_landmarks.py`
4. Calculate engineered features: `uv run training_data/append_features.py`
5. Train the model on the labelled data: `uv run train_model.py`
6. Export the trained model into the app's TensorFlow.js format and verify it loads in JavaScript: `cd ../.. && npm run gesture:model:export`

The training output is saved in `./model.h5`.

The browser artifact is written to `../../public/model/`:

- `model.json`
- `group1-shard1of1.bin`

