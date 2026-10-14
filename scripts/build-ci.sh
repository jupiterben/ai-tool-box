#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
PLATFORM="${1:?Usage: build-ci.sh win|mac|linux}"
EXTRA=()
if [[ -n "${TAURI_SIGNING_PRIVATE_KEY:-}" ]]; then
  [[ -n "${TAURI_UPDATER_PUBLIC_KEY:-}" ]] || { echo "Missing updater public key" >&2; exit 1; }
  EXTRA=(--config '{"bundle":{"createUpdaterArtifacts":true}}')
fi
case "$PLATFORM" in
  win) pnpm desktop:build --bundles nsis "${EXTRA[@]}" ;;
  mac) pnpm desktop:build --bundles app,dmg "${EXTRA[@]}" ;;
  linux) pnpm desktop:build --bundles appimage,deb "${EXTRA[@]}" ;;
  *) echo "Unknown platform: $PLATFORM" >&2; exit 1 ;;
esac
node scripts/collect-tauri-artifacts.mjs "$PLATFORM"
