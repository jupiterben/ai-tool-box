#!/usr/bin/env bash
# 从 electron-builder 输出目录中只保留可分发产物，删除 unpacked 中间目录
# 用法: bash scripts/collect-release-artifacts.sh [release_dir]

set -euo pipefail

RELEASE_DIR="${1:?用法: collect-release-artifacts.sh <release_dir>}"
RELEASE_DIR="$(cd "$RELEASE_DIR" && pwd)"

STAGING="$(mktemp -d)"
trap 'rm -rf "$STAGING"' EXIT

while IFS= read -r -d '' file; do
  cp "$file" "$STAGING/"
done < <(find "$RELEASE_DIR" -maxdepth 1 -type f \( \
  -name '*.exe' -o -name '*.zip' -o -name '*.dmg' -o -name '*.AppImage' \
  -o -name '*.blockmap' -o -name 'latest.yml' -o -name 'latest-mac.yml' \
  -o -name 'latest-linux.yml' \) -print0)

ARTIFACTS=()
for file in "$STAGING"/*; do
  [[ -f "$file" ]] && ARTIFACTS+=("$(basename "$file")")
done
if [ ${#ARTIFACTS[@]} -eq 0 ]; then
  echo "未找到可分发产物: $RELEASE_DIR" >&2
  ls -la "$RELEASE_DIR" >&2 || true
  exit 1
fi

rm -rf "$RELEASE_DIR"/*
mv "$STAGING"/* "$RELEASE_DIR/"

echo "保留 ${#ARTIFACTS[@]} 个发布文件:"
printf '  - %s\n' "${ARTIFACTS[@]}"
