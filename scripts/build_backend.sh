#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PY_SRC="$ROOT_DIR/app/api_server.py"
OUTPUT_DIR="$ROOT_DIR/app/desktop/src-tauri/bin"

mkdir -p "$OUTPUT_DIR"

if ! python -m PyInstaller --version >/dev/null 2>&1; then
  echo "PyInstaller is not installed. Run 'python -m pip install pyinstaller' and retry." >&2
  exit 1
fi

OUTPUT_NAME="api_server"
if command -v rustc >/dev/null 2>&1; then
  TARGET_TRIPLE=$(rustc -Vv | awk -F': ' '/^host:/ {print $2}')
  if [[ -n "${TARGET_TRIPLE:-}" ]]; then
    OUTPUT_NAME="api_server-$TARGET_TRIPLE"
  fi
fi

python -m PyInstaller --onefile --name "$OUTPUT_NAME" --distpath "$OUTPUT_DIR" "$PY_SRC"

echo "Backend binary written to $OUTPUT_DIR"