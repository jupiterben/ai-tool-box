#!/usr/bin/env bash
# CI 多平台构建（不自增版本，版本由 git tag 决定）
# 用法: bash scripts/build-ci.sh win|mac|linux

set -euo pipefail

PLATFORM="${1:?用法: build-ci.sh win|mac|linux}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RELEASE_DIR="$ROOT/release"
PKG="package.json"

rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

export CSC_IDENTITY_AUTO_DISCOVERY="${CSC_IDENTITY_AUTO_DISCOVERY:-false}"

read_version() {
  local line
  line="$(grep -E '^[[:space:]]*"version"[[:space:]]*:' "$PKG" | head -n1)"
  if [[ "$line" =~ \"version\"[[:space:]]*:[[:space:]]*\"([^\"]+)\" ]]; then
    echo "${BASH_REMATCH[1]}"
    return
  fi
  echo "无法读取 version" >&2
  exit 1
}

VERSION="$(read_version)"
echo "📌 构建版本: $VERSION ($PLATFORM)"

echo "🎨 生成应用图标..."
pnpm run generate:icon

echo "🔨 编译前端 + 主进程..."
pnpm run build
pnpm run electron:compile

echo "📦 electron-builder ($PLATFORM)..."
case "$PLATFORM" in
win)
  npx electron-builder --win --x64 --publish never --config.directories.output="$RELEASE_DIR"
  # Windows 差分更新基于 NSIS .exe.blockmap，统一用脚本生成 latest.yml
  bash "$ROOT/scripts/generate-latest-yml.sh" win "$RELEASE_DIR" "$VERSION"
  ;;
mac)
  npx electron-builder --mac --publish never --config.directories.output="$RELEASE_DIR"
  if [[ -f "$RELEASE_DIR/latest-mac.yml" ]]; then
    echo "📝 使用 electron-builder 生成的 latest-mac.yml（差分更新）"
  else
    bash "$ROOT/scripts/generate-latest-yml.sh" mac "$RELEASE_DIR" "$VERSION"
  fi
  ;;
linux)
  npx electron-builder --linux --x64 --publish never --config.directories.output="$RELEASE_DIR"
  if [[ -f "$RELEASE_DIR/latest-linux.yml" ]]; then
    echo "📝 使用 electron-builder 生成的 latest-linux.yml（差分更新）"
  else
    bash "$ROOT/scripts/generate-latest-yml.sh" linux "$RELEASE_DIR" "$VERSION"
  fi
  ;;
*)
  echo "未知平台: $PLATFORM（支持 win / mac / linux）" >&2
  exit 1
  ;;
esac

bash "$ROOT/scripts/collect-release-artifacts.sh" "$RELEASE_DIR"
bash "$ROOT/scripts/verify-release-artifacts.sh" "$PLATFORM" "$RELEASE_DIR"

echo "✅ 产物目录: $RELEASE_DIR"
ls -la "$RELEASE_DIR"
