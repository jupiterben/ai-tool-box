#!/usr/bin/env bash
# 校验 CI 发布目录是否包含该平台必需的二进制产物
# 用法: bash scripts/verify-release-artifacts.sh <win|mac|linux> [release_dir]

set -euo pipefail

PLATFORM="${1:?用法: verify-release-artifacts.sh <win|mac|linux> [release_dir]}"
RELEASE_DIR="${2:-release}"

shopt -s nullglob
case "$PLATFORM" in
win)
  EXES=("$RELEASE_DIR"/*.exe)
  ZIPS=("$RELEASE_DIR"/*.zip)
  YMLS=("$RELEASE_DIR"/latest.yml)
  if [[ ${#EXES[@]} -eq 0 || ${#ZIPS[@]} -eq 0 || ${#YMLS[@]} -eq 0 ]]; then
    echo "❌ Windows 产物不完整（需要 .exe + .zip + latest.yml）" >&2
    ls -la "$RELEASE_DIR" >&2 || true
    exit 1
  fi
  ;;
mac)
  DMGS=("$RELEASE_DIR"/*.dmg)
  ZIPS=("$RELEASE_DIR"/*.zip)
  YMLS=("$RELEASE_DIR"/latest-mac.yml)
  if [[ ${#DMGS[@]} -eq 0 || ${#ZIPS[@]} -eq 0 || ${#YMLS[@]} -eq 0 ]]; then
    echo "❌ macOS 产物不完整（需要 .dmg + .zip + latest-mac.yml）" >&2
    ls -la "$RELEASE_DIR" >&2 || true
    exit 1
  fi
  ;;
linux)
  IMAGES=("$RELEASE_DIR"/*.AppImage)
  YMLS=("$RELEASE_DIR"/latest-linux.yml)
  if [[ ${#IMAGES[@]} -eq 0 || ${#YMLS[@]} -eq 0 ]]; then
    echo "❌ Linux 产物不完整（需要 .AppImage + latest-linux.yml）" >&2
    ls -la "$RELEASE_DIR" >&2 || true
    exit 1
  fi
  ;;
*)
  echo "未知平台: $PLATFORM" >&2
  exit 1
  ;;
esac
shopt -u nullglob

echo "✅ $PLATFORM 产物校验通过"
