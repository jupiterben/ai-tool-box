#!/usr/bin/env bash
# 自增 package.json 的 semver，并仅提交该文件。不依赖 Node 的 bump-version 脚本。
# 用法: ./scripts/bump-version-commit.sh [patch|minor|major] [commit message...]
# 环境变量: BUMP_LEVEL（未传第一参时默认 patch）、COMMIT_MSG；SKIP_VERSION_BUMP=1 则退出且不提交

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PKG="package.json"

if [[ "${SKIP_VERSION_BUMP:-}" == "1" ]]; then
  echo "[bump-version-commit] SKIP_VERSION_BUMP=1，跳过"
  exit 0
fi

level="${BUMP_LEVEL:-patch}"
commit_msg="${COMMIT_MSG:-}"
if [[ $# -ge 1 && "$1" =~ ^(patch|minor|major)$ ]]; then
  level="$1"
  shift
fi
if [[ $# -ge 1 ]]; then
  commit_msg="$*"
fi
if [[ ! "$level" =~ ^(patch|minor|major)$ ]]; then
  echo "版本递增粒度必须是 patch、minor 或 major" >&2
  exit 1
fi

read_old_version() {
  local line
  line="$(grep -E '^[[:space:]]*"version"[[:space:]]*:' "$PKG" | head -n1)"
  if [[ "$line" =~ \"version\"[[:space:]]*:[[:space:]]*\"([^\"]+)\" ]]; then
    echo "${BASH_REMATCH[1]}"
    return
  fi
  echo "无法从 $PKG 读取 version" >&2
  return 1
}

bump_core() {
  local v="$1" level="$2"
  local major minor patch rest
  v="${v%%[-+]*}"
  v="${v%%-*}"
  major="${v%%.*}"
  rest="${v#*.}"
  minor="${rest%%.*}"
  patch="${rest#*.}"
  major="${major:-0}"
  minor="${minor:-0}"
  patch="${patch:-0}"
  case "$level" in
  major) echo "$((major + 1)).0.0" ;;
  minor) echo "${major}.$((minor + 1)).0" ;;
  patch) echo "${major}.${minor}.$((patch + 1))" ;;
  esac
}

OLD="$(read_old_version)"
NEW="$(bump_core "$OLD" "$level")"

if ! command -v git >/dev/null 2>&1; then
  echo "需要 git" >&2
  exit 1
fi

# sed 基本正则里 . 会匹配任意字符，对版本号中的点做转义
old_esc=$(printf '%s' "$OLD" | sed 's/\./\\./g')

if sed --version >/dev/null 2>&1; then
  sed -i "s/\"version\"[[:space:]]*:[[:space:]]*\"${old_esc}\"/\"version\": \"${NEW}\"/" "$PKG"
else
  sed -i '' "s/\"version\"[[:space:]]*:[[:space:]]*\"${old_esc}\"/\"version\": \"${NEW}\"/" "$PKG"
fi

msg="${commit_msg:-chore: bump version ${OLD} → ${NEW}}"
git add -- "$PKG"
if git diff --staged --quiet; then
  echo "无变更，未提交" >&2
  exit 1
fi
git commit -m "$msg"
echo "[bump-version-commit] 已提交: ${OLD} → ${NEW} ($level) — $msg"
