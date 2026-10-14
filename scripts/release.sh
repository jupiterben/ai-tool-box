#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
# Version/tag publication remains in the existing `pnpm release` command.
pnpm desktop:build "$@"
node scripts/collect-tauri-artifacts.mjs
