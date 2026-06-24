#!/usr/bin/env bash
# 为 Windows 增量更新生成 latest.yml（path 指向 zip）
# 用法: bash scripts/generate-latest-yml.sh [release_dir] [version]

set -euo pipefail

RELEASE_DIR="${1:-./release}"
VERSION="${2:-}"

if [[ -z "$VERSION" ]]; then
  PKG="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/package.json"
  line="$(grep -E '^[[:space:]]*"version"[[:space:]]*:' "$PKG" | head -n1)"
  if [[ "$line" =~ \"version\"[[:space:]]*:[[:space:]]*\"([^\"]+)\" ]]; then
    VERSION="${BASH_REMATCH[1]}"
  else
    echo "无法读取 version" >&2
    exit 1
  fi
fi

INSTALLER=""
for f in "$RELEASE_DIR"/*.exe; do
  [[ -f "$f" ]] && INSTALLER="$f" && break
done

ZIPFILE=""
for f in "$RELEASE_DIR"/*.zip; do
  [[ -f "$f" ]] && ZIPFILE="$f" && break
done

if [[ -z "$INSTALLER" ]]; then
  echo "❌ 未找到安装包 (.exe)" >&2
  exit 1
fi
if [[ -z "$ZIPFILE" ]]; then
  echo "❌ 未找到更新包 (.zip)" >&2
  exit 1
fi

INSTALLER_NAME="$(basename "$INSTALLER")"
ZIP_NAME="$(basename "$ZIPFILE")"
ZIP_SIZE="$(stat -c%s "$ZIPFILE" 2>/dev/null || stat -f%z "$ZIPFILE")"

if command -v sha512sum >/dev/null 2>&1; then
  SHA512_HEX="$(sha512sum "$ZIPFILE" | awk '{print $1}')"
elif command -v openssl >/dev/null 2>&1; then
  SHA512_HEX="$(openssl dgst -sha512 "$ZIPFILE" | awk '{print $NF}')"
else
  echo "❌ 需要 sha512sum 或 openssl" >&2
  exit 1
fi

SHA512_BASE64="$(echo -n "$SHA512_HEX" | xxd -r -p | base64 | tr -d '\n')"
RELEASE_DATE="$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")"
MANDATORY="${MANDATORY:-false}"

LATEST_YML="$RELEASE_DIR/latest.yml"
cat > "$LATEST_YML" <<EOF
version: $VERSION
files:
  - url: $ZIP_NAME
    sha512: $SHA512_BASE64
    size: $ZIP_SIZE
path: $ZIP_NAME
sha512: $SHA512_BASE64
releaseDate: '$RELEASE_DATE'
mandatory: $MANDATORY
installer: $INSTALLER_NAME
EOF

echo "📝 已生成 $LATEST_YML"
