#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.cargo/bin:$HOME/.local/bin:$HOME/.local/share/writ-tools/node/bin:$PATH"
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$HOME/.cache/writ-target}"
export CARGO_BUILD_JOBS=2
export DIR_TO_DOWNLOAD_BINARY="${DIR_TO_DOWNLOAD_BINARY:-$HOME/.cache/writ-sandbox}"
cd "$(dirname "${BASH_SOURCE[0]}")/.."
exec "$@"
