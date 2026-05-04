#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Iterable


ROOT_DIR = Path(__file__).resolve().parent
VIDEOS_DIR = ROOT_DIR / "00_videos"
IMAGES_DIR = ROOT_DIR / "01_images"
FRAME_INTERVAL_SECONDS = 0.1
SKIP_SECONDS = 0.5          # how much to trim off the start/end of the video
OUTPUT_PATTERN_WIDTH = 4    # suffix number length (e.g. gesture_0013)


def get_video_duration(video_path: Path) -> float:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_entries",
            "format=duration",
            str(video_path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    payload = json.loads(result.stdout)
    return float(payload["format"]["duration"])


def infer_gesture_name(video_path: Path) -> str:
    stem = video_path.stem
    if "_" not in stem:
        return stem
    return stem.rsplit("_", 1)[0]


def next_frame_number(output_dir: Path, gesture_name: str) -> int:
    existing_numbers = []

    for image_path in output_dir.glob(f"{gesture_name}_*.png"):
        suffix = image_path.stem.removeprefix(f"{gesture_name}_")
        if suffix.isdigit():
            existing_numbers.append(int(suffix))

    if not existing_numbers:
        return 1

    return max(existing_numbers) + 1


def extract_frames(video_path: Path, output_dir: Path, gesture_name: str) -> None:
    duration = get_video_duration(video_path)
    trimmed_duration = duration - (SKIP_SECONDS * 2)

    if trimmed_duration <= 0:
        print(
            f"Skipping {video_path.name}: duration {duration:.2f}s is too short "
            f"to skip {SKIP_SECONDS:.1f}s at both ends.",
            file=sys.stderr,
        )
        return

    output_dir.mkdir(parents=True, exist_ok=True)
    start_number = next_frame_number(output_dir, gesture_name)
    output_pattern = output_dir / f"{gesture_name}_%0{OUTPUT_PATTERN_WIDTH}d.png"
    fps = 1 / FRAME_INTERVAL_SECONDS

    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-ss",
            f"{SKIP_SECONDS}",
            "-i",
            str(video_path),
            "-t",
            f"{trimmed_duration}",
            "-vf",
            f"fps={fps}",
            "-start_number",
            str(start_number),
            str(output_pattern),
        ],
        check=True,
    )

    print(f"Extracted frames from {video_path.name} -> {output_dir.relative_to(ROOT_DIR)}")


def grouped_video_paths(video_paths: Iterable[Path]) -> dict[str, list[Path]]:
    grouped: dict[str, list[Path]] = {}

    for video_path in video_paths:
        gesture_name = infer_gesture_name(video_path)
        grouped.setdefault(gesture_name, []).append(video_path)

    return grouped


def main() -> int:
    if not VIDEOS_DIR.exists():
        print(f"Input directory does not exist: {VIDEOS_DIR}", file=sys.stderr)
        return 1

    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    video_paths = sorted(VIDEOS_DIR.glob("*.mp4"))
    if not video_paths:
        print(f"No .mp4 files found in {VIDEOS_DIR}", file=sys.stderr)
        return 1

    for gesture_name, gesture_video_paths in grouped_video_paths(video_paths).items():
        output_dir = IMAGES_DIR / gesture_name
        for video_path in gesture_video_paths:
            extract_frames(video_path, output_dir, gesture_name)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
