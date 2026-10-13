#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
case "${1:?Usage: build-ci.sh win|mac|linux}" in
  win) pnpm build --bundles nsis ;;
  mac) pnpm build --bundles dmg ;;
  linux) pnpm build --bundles appimage,deb ;;
  *) echo "Unknown platform" >&2; exit 1 ;;
esac
node scripts/collect-tauri-artifacts.mjs
