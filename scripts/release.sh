#!/usr/bin/env bash
# 一键编译并生成发布产物
# 构建产物：NSIS 安装包（首次安装用）+ zip 包（增量更新用）+ latest.yml
# 用法:
#   bash scripts/release.sh              # 自增 patch 并发布
#   bash scripts/release.sh minor        # 自增 minor 并发布
#   bash scripts/release.sh --no-bump    # 跳过版本自增，直接编译发布当前版本
#   bash scripts/release.sh --mandatory  # 标记为重要更新（可与其他参数组合）
#   bash scripts/release.sh minor --mandatory

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RELEASE_DIR="../ys-npc-release"
PKG="package.json"

# ── 参数 ───────────────────────────────────────────────────────────

BUMP_LEVEL="patch"
SKIP_BUMP=false
MANDATORY=false

for arg in "$@"; do
  case "$arg" in
    --no-bump)   SKIP_BUMP=true ;;
    --mandatory) MANDATORY=true ;;
    patch|minor|major) BUMP_LEVEL="$arg" ;;
  esac
done

# ── 读取版本 ───────────────────────────────────────────────────────

read_version() {
  local line
  line="$(grep -E '^[[:space:]]*"version"[[:space:]]*:' "$PKG" | head -n1)"
  if [[ "$line" =~ \"version\"[[:space:]]*:[[:space:]]*\"([^\"]+)\" ]]; then
    echo "${BASH_REMATCH[1]}"
    return
  fi
  echo "无法读取 version" >&2; exit 1
}

# ── 1. 版本自增 ───────────────────────────────────────────────────

if [[ "$SKIP_BUMP" == false ]]; then
  echo "📦 自增版本 ($BUMP_LEVEL)..."
  bash scripts/bump-version-commit.sh "$BUMP_LEVEL"
fi

VERSION="$(read_version)"
echo "📌 当前版本: $VERSION"

# ── 2. 清理旧构建产物 ─────────────────────────────────────────────

if [[ -d "$RELEASE_DIR" ]]; then
  echo "🧹 清理旧构建产物..."
  rm -rf "$RELEASE_DIR"
fi

# ── 3. 编译 ───────────────────────────────────────────────────────

echo "🎨 生成应用图标..."
pnpm run generate:icon

echo "🔨 编译前端 + 主进程..."
pnpm run build
pnpm run electron:compile

echo "📦 打包 Windows 安装包 + zip..."
npx electron-builder --win --x64

# ── 4. 定位安装包和 zip ─────────────────────────────────────────

INSTALLER=""
for f in "$RELEASE_DIR"/*.exe; do
  [[ -f "$f" ]] && INSTALLER="$f" && break
done

ZIPFILE=""
for f in "$RELEASE_DIR"/*.zip; do
  [[ -f "$f" ]] && ZIPFILE="$f" && break
done

if [[ -z "$INSTALLER" ]]; then
  echo "❌ 未找到安装包 (.exe)" >&2; exit 1
fi
if [[ -z "$ZIPFILE" ]]; then
  echo "❌ 未找到更新包 (.zip)" >&2; exit 1
fi

INSTALLER_NAME="$(basename "$INSTALLER")"
ZIP_NAME="$(basename "$ZIPFILE")"
ZIP_SIZE="$(stat -c%s "$ZIPFILE" 2>/dev/null || stat -f%z "$ZIPFILE")"
echo "📄 安装包: $INSTALLER_NAME"
echo "📄 更新包: $ZIP_NAME ($ZIP_SIZE bytes)"

# ── 5. 生成 sha512（基于 zip 包）──────────────────────────────────

echo "🔑 计算 sha512..."
if command -v sha512sum >/dev/null 2>&1; then
  SHA512_HEX="$(sha512sum "$ZIPFILE" | awk '{print $1}')"
elif command -v openssl >/dev/null 2>&1; then
  SHA512_HEX="$(openssl dgst -sha512 "$ZIPFILE" | awk '{print $NF}')"
else
  echo "❌ 需要 sha512sum 或 openssl" >&2; exit 1
fi

SHA512_BASE64="$(echo -n "$SHA512_HEX" | xxd -r -p | base64 | tr -d '\n')"
RELEASE_DATE="$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")"

# ── 6. 生成 latest.yml（path 指向 zip 用于增量更新）────────────────

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
[[ "$MANDATORY" == true ]] && echo "⚠️  已标记为重要更新"
cat "$LATEST_YML"

echo ""
echo "✅ 构建完成! v$VERSION"
echo "   $INSTALLER  (首次安装)"
echo "   $ZIPFILE  (增量更新)"
echo "   $LATEST_YML"
