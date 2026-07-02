#!/usr/bin/env bash
# 校验 CI 发布目录是否包含该平台必需的二进制产物（含差分更新 blockmap）
# 用法: bash scripts/verify-release-artifacts.sh <win|mac|linux> [release_dir]

set -euo pipefail

PLATFORM="${1:?用法: verify-release-artifacts.sh <win|mac|linux> [release_dir]}"
RELEASE_DIR="${2:-release}"

require_blockmap() {
  local file="$1"
  if [[ ! -f "${file}.blockmap" ]]; then
    echo "❌ 缺少差分更新 blockmap: ${file}.blockmap" >&2
    ls -la "$RELEASE_DIR" >&2 || true
    exit 1
  fi
}

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
  require_blockmap "${EXES[0]}"
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
  for zip in "${ZIPS[@]}"; do
    require_blockmap "$zip"
  done
  ;;
linux)
  IMAGES=("$RELEASE_DIR"/*.AppImage)
  YMLS=("$RELEASE_DIR"/latest-linux.yml)
  if [[ ${#IMAGES[@]} -eq 0 || ${#YMLS[@]} -eq 0 ]]; then
    echo "❌ Linux 产物不完整（需要 .AppImage + latest-linux.yml）" >&2
    ls -la "$RELEASE_DIR" >&2 || true
    exit 1
  fi
  # AppImage 的 blockmap 内嵌在二进制末尾，由 latest-linux.yml 的 blockMapSize 引用
  if ! grep -q 'blockMapSize' "${YMLS[0]}"; then
    if [[ -f "${IMAGES[0]}.blockmap" ]]; then
      echo "ℹ️  使用独立 .blockmap 文件"
    else
      echo "❌ latest-linux.yml 缺少 blockMapSize，无法差分更新" >&2
      cat "${YMLS[0]}" >&2
      exit 1
    fi
  fi
  ;;
*)
  echo "未知平台: $PLATFORM" >&2
  exit 1
  ;;
esac
shopt -u nullglob

echo "✅ $PLATFORM 产物校验通过（含差分更新元数据）"
