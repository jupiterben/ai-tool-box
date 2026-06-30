#!/usr/bin/env bash
# 创建 GitHub Release 并上传产物（带退避重试，应对 secondary rate limit）
# 用法: bash scripts/publish-github-release.sh <tag> [dist_dir]

set -euo pipefail

TAG="${1:?用法: publish-github-release.sh <tag> [dist_dir]}"
DIST_DIR="${2:-dist}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-6}"

mapfile -t FILES < <(find "$DIST_DIR" -maxdepth 1 -type f \( \
  -name '*.exe' -o -name '*.zip' -o -name '*.dmg' -o -name '*.AppImage' \
  -o -name 'latest.yml' -o -name '*.blockmap' \) | sort)
if [ ${#FILES[@]} -eq 0 ]; then
  echo "未找到发布文件: $DIST_DIR" >&2
  exit 1
fi

echo "待上传 ${#FILES[@]} 个文件:"
printf '  - %s\n' "${FILES[@]}"

BODY_FILE="$(mktemp)"
trap 'rm -f "$BODY_FILE"' EXIT
cat > "$BODY_FILE" <<EOF
## AI Tool Box ${TAG}

| 平台 | 产物 |
|------|------|
| Windows | NSIS 安装包 (.exe) + 增量更新 (.zip) + latest.yml |
| macOS | DMG (.dmg, x64 + arm64) |
| Linux | AppImage (.AppImage) |
EOF

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  echo "Release 尝试 ${attempt}/${MAX_ATTEMPTS}..."

  if gh release view "$TAG" >/dev/null 2>&1; then
    if gh release upload "$TAG" "${FILES[@]}" --clobber; then
      echo "Release 资源上传成功"
      exit 0
    fi
  elif gh release create "$TAG" \
    --title "Release ${TAG}" \
    --notes-file "$BODY_FILE" \
    "${FILES[@]}"; then
    echo "Release 创建成功"
    exit 0
  fi

  if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
    wait_seconds=$((attempt * 60))
    echo "发布失败（可能触发 rate limit），${wait_seconds}s 后重试..."
    sleep "$wait_seconds"
  fi
done

echo "Release 在 ${MAX_ATTEMPTS} 次尝试后仍失败" >&2
exit 1
