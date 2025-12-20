#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUNDLE_DIR="${1:-$ROOT_DIR/app/desktop/src-tauri/target/release/bundle}"
BIN_NAME="api_server"

if [[ ! -d "$BUNDLE_DIR" ]]; then
  echo "Bundle directory not found: $BUNDLE_DIR" >&2
  exit 1
fi

matches=$(find "$BUNDLE_DIR" -type f \( -name "$BIN_NAME" -o -name "$BIN_NAME.exe" -o -name "${BIN_NAME}-*" -o -name "${BIN_NAME}-*.exe" \))

if [[ -z "$matches" ]]; then
  echo "Expected backend binary '$BIN_NAME' not found in bundle output." >&2
  exit 1
fi

echo "Backend binary detected in bundle output:"
echo "$matches"