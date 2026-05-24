#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = ROOT_DIR.parent.parent
MODEL_PATH = ROOT_DIR / "model.h5"
OUTPUT_DIR = PROJECT_ROOT / "public" / "model"
MODEL_JSON_PATH = OUTPUT_DIR / "model.json"
VERIFICATION_SCRIPT_PATH = ROOT_DIR / "verify_tfjs_export.mjs"
CONVERTER_BIN = ROOT_DIR / ".venv" / "bin" / "tensorflowjs_converter"
NODE_BIN = shutil.which("node")


def clean_output_dir(output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    for path in output_dir.iterdir():
        if path.name == ".gitkeep":
            continue
        if path.is_file():
            path.unlink()
        elif path.is_dir():
            shutil.rmtree(path)


def build_converter_env(sitecustomize_dir: Path) -> dict[str, str]:
    env = os.environ.copy()
    sitecustomize_path = sitecustomize_dir / "sitecustomize.py"
    sitecustomize_path.write_text(
        "\n".join(
            [
                "import sys",
                "import types",
                "",
                "def ensure(name):",
                "    module = sys.modules.get(name)",
                "    if module is None:",
                "        module = types.ModuleType(name)",
                "        sys.modules[name] = module",
                "    return module",
                "",
                "ensure('tensorflow_decision_forests')",
                "ensure('tensorflow_hub')",
                "jax = ensure('jax')",
                "experimental = ensure('jax.experimental')",
                "jax.experimental = experimental",
                "jax2tf = ensure('jax.experimental.jax2tf')",
                "experimental.jax2tf = jax2tf",
                "",
                "def _convert(*args, **kwargs):",
                "    raise RuntimeError('jax2tf.convert is unavailable in this environment')",
                "",
                "jax2tf.convert = _convert",
                "",
            ]
        ),
        encoding="utf-8",
    )

    python_path_parts = [str(sitecustomize_dir)]
    existing_python_path = env.get("PYTHONPATH")
    if existing_python_path:
        python_path_parts.append(existing_python_path)
    env["PYTHONPATH"] = os.pathsep.join(python_path_parts)
    env["MPLCONFIGDIR"] = str(sitecustomize_dir / "matplotlib")
    return env


def run_converter() -> None:
    if not CONVERTER_BIN.exists():
        raise FileNotFoundError(f"TensorFlow.js converter not found: {CONVERTER_BIN}")

    clean_output_dir(OUTPUT_DIR)
    with tempfile.TemporaryDirectory(prefix="tfjs-export-sitecustomize-") as temp_dir:
        env = build_converter_env(Path(temp_dir))
        subprocess.run(
            [
                str(CONVERTER_BIN),
                "--input_format=keras",
                str(MODEL_PATH),
                str(OUTPUT_DIR),
            ],
            check=True,
            cwd=PROJECT_ROOT,
            env=env,
        )


def patch_model_json() -> None:
    model_json = json.loads(MODEL_JSON_PATH.read_text(encoding="utf-8"))

    layers = (
        model_json.get("modelTopology", {})
        .get("model_config", {})
        .get("config", {})
        .get("layers", [])
    )
    for layer in layers:
        if layer.get("class_name") != "InputLayer":
            continue
        layer_config = layer.get("config")
        if not isinstance(layer_config, dict):
            continue
        batch_shape = layer_config.pop("batch_shape", None)
        if batch_shape is not None and "batch_input_shape" not in layer_config:
            layer_config["batch_input_shape"] = batch_shape

    for group in model_json.get("weightsManifest", []):
        for weight in group.get("weights", []):
            name = weight.get("name")
            if isinstance(name, str) and name.startswith("sequential/"):
                weight["name"] = name.removeprefix("sequential/")

    MODEL_JSON_PATH.write_text(json.dumps(model_json, indent=2) + "\n", encoding="utf-8")


def verify_in_node() -> None:
    if NODE_BIN is None:
        raise FileNotFoundError("Node.js is required to verify the exported TensorFlow.js model")
    subprocess.run(
        [NODE_BIN, str(VERIFICATION_SCRIPT_PATH), str(OUTPUT_DIR)],
        check=True,
        cwd=PROJECT_ROOT,
    )


def export_model() -> int:
    if not MODEL_PATH.exists():
        print(f"Model file not found: {MODEL_PATH}", file=sys.stderr)
        return 1

    try:
        run_converter()
        patch_model_json()
        verify_in_node()
    except (FileNotFoundError, subprocess.CalledProcessError) as error:
        print(str(error), file=sys.stderr)
        return 1

    print(f"Exported and verified TensorFlow.js model at {OUTPUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(export_model())
