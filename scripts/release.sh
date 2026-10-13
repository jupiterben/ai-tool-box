#!/usr/bin/env bash
# Build only. Version changes, commits and publication are explicit operations.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
pnpm build "$@"
node scripts/collect-tauri-artifacts.mjs
