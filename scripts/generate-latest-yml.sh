#!/usr/bin/env bash
# 为 electron-updater 生成 latest*.yml
# 用法: bash scripts/generate-latest-yml.sh <win|mac|linux> [release_dir] [version]

set -euo pipefail

PLATFORM="${1:?用法: generate-latest-yml.sh <win|mac|linux> [release_dir] [version]}"
RELEASE_DIR="${2:-./release}"
VERSION="${3:-}"

if [[ "$PLATFORM" == "win" || "$PLATFORM" == "mac" || "$PLATFORM" == "linux" ]]; then
  :
else
  # 兼容旧用法: generate-latest-yml.sh [release_dir] [version]
  VERSION="${2:-}"
  RELEASE_DIR="${1:-./release}"
  PLATFORM="win"
fi

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

file_size() {
  stat -c%s "$1" 2>/dev/null || stat -f%z "$1"
}

sha512_base64() {
  local file="$1"
  local sha512_hex=""
  if command -v sha512sum >/dev/null 2>&1; then
    sha512_hex="$(sha512sum "$file" | awk '{print $1}')"
  elif command -v openssl >/dev/null 2>&1; then
    sha512_hex="$(openssl dgst -sha512 "$file" | awk '{print $NF}')"
  else
    echo "❌ 需要 sha512sum 或 openssl" >&2
    exit 1
  fi
  echo -n "$sha512_hex" | xxd -r -p | base64 | tr -d '\n'
}

RELEASE_DATE="$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")"
MANDATORY="${MANDATORY:-false}"

write_file_entry() {
  local file="$1"
  local name
  name="$(basename "$file")"
  local size
  size="$(file_size "$file")"
  local sha512
  sha512="$(sha512_base64 "$file")"
  local blockmap="${file}.blockmap"

  if [[ -f "$blockmap" ]]; then
    local block_map_size
    block_map_size="$(file_size "$blockmap")"
    cat <<EOF
  - url: $name
    sha512: $sha512
    size: $size
    blockMapSize: $block_map_size
EOF
  else
    cat <<EOF
  - url: $name
    sha512: $sha512
    size: $size
EOF
  fi
}

case "$PLATFORM" in
win)
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
  INSTALLER_SHA512="$(sha512_base64 "$INSTALLER")"
  INSTALLER_SIZE="$(file_size "$INSTALLER")"
  LATEST_YML="$RELEASE_DIR/latest.yml"

  # Windows 差分更新走 NSIS .exe（electron-builder 仅为其生成 .blockmap，zip 无 blockmap）
  BLOCKMAP_LINES=""
  if [[ -f "${INSTALLER}.blockmap" ]]; then
    BLOCKMAP_SIZE="$(file_size "${INSTALLER}.blockmap")"
    BLOCKMAP_LINES="    blockMapSize: $BLOCKMAP_SIZE"
  fi

  cat > "$LATEST_YML" <<EOF
version: $VERSION
files:
  - url: $INSTALLER_NAME
    sha512: $INSTALLER_SHA512
    size: $INSTALLER_SIZE
${BLOCKMAP_LINES}
path: $INSTALLER_NAME
sha512: $INSTALLER_SHA512
releaseDate: '$RELEASE_DATE'
mandatory: $MANDATORY
EOF
  ;;

mac)
  shopt -s nullglob
  MAC_ZIPS=("$RELEASE_DIR"/*.zip)
  shopt -u nullglob

  if [[ ${#MAC_ZIPS[@]} -eq 0 ]]; then
    echo "❌ 未找到 mac 更新包 (.zip)" >&2
    exit 1
  fi

  PRIMARY_ZIP="${MAC_ZIPS[0]}"
  PRIMARY_NAME="$(basename "$PRIMARY_ZIP")"
  PRIMARY_SHA512="$(sha512_base64 "$PRIMARY_ZIP")"
  LATEST_YML="$RELEASE_DIR/latest-mac.yml"

  {
    echo "version: $VERSION"
    echo "files:"
    for zip in "${MAC_ZIPS[@]}"; do
      write_file_entry "$zip"
    done
    cat <<EOF
path: $PRIMARY_NAME
sha512: $PRIMARY_SHA512
releaseDate: '$RELEASE_DATE'
mandatory: $MANDATORY
EOF
  } > "$LATEST_YML"
  ;;

linux)
  APPIMAGE=""
  for f in "$RELEASE_DIR"/*.AppImage; do
    [[ -f "$f" ]] && APPIMAGE="$f" && break
  done

  if [[ -z "$APPIMAGE" ]]; then
    echo "❌ 未找到 AppImage" >&2
    exit 1
  fi

  APPIMAGE_NAME="$(basename "$APPIMAGE")"
  APPIMAGE_SHA512="$(sha512_base64 "$APPIMAGE")"
  APPIMAGE_SIZE="$(file_size "$APPIMAGE")"
  LATEST_YML="$RELEASE_DIR/latest-linux.yml"

  BLOCKMAP_LINES=""
  if [[ -f "${APPIMAGE}.blockmap" ]]; then
    BLOCKMAP_SIZE="$(file_size "${APPIMAGE}.blockmap")"
    BLOCKMAP_LINES="    blockMapSize: $BLOCKMAP_SIZE"
  fi

  cat > "$LATEST_YML" <<EOF
version: $VERSION
files:
  - url: $APPIMAGE_NAME
    sha512: $APPIMAGE_SHA512
    size: $APPIMAGE_SIZE
${BLOCKMAP_LINES}
path: $APPIMAGE_NAME
sha512: $APPIMAGE_SHA512
releaseDate: '$RELEASE_DATE'
mandatory: $MANDATORY
EOF
  ;;

*)
  echo "未知平台: $PLATFORM（支持 win / mac / linux）" >&2
  exit 1
  ;;
esac

echo "📝 已生成 $LATEST_YML"
