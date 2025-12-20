#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESKTOP_DIR="$ROOT_DIR/app/desktop"

"$ROOT_DIR/scripts/build_backend.sh"

pushd "$DESKTOP_DIR" >/dev/null
npm install
npm run build
npm run tauri build
popd >/dev/null

"$ROOT_DIR/scripts/verify_bundle.sh"