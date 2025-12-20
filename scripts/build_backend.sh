#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PY_SRC="$ROOT_DIR/app/api_server.py"
OUTPUT_DIR="$ROOT_DIR/app/desktop/src-tauri/bin"

mkdir -p "$OUTPUT_DIR"

python -m PyInstaller --onefile --name api_server --distpath "$OUTPUT_DIR" "$PY_SRC"

echo "Backend binary written to $OUTPUT_DIR"