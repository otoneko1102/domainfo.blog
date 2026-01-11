#!/usr/bin/env bash

# Update selected parts of this project from upstream repo
# - src/
# - routes/
# - package.json
# - package-lock.json
# - vite.config.js
#
# Upstream default: https://github.com/otoneko1102/blog.git

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")"/.. && pwd)"
DEFAULT_UPSTREAM="https://github.com/otoneko1102/blog.git"
UPSTREAM_URL="$DEFAULT_UPSTREAM"
DO_DRY_RUN=false
DO_INSTALL=false
DO_BACKUP=true

usage() {
  cat <<'USAGE'
Usage: tools/update-from-blog.sh [options]

Options:
  --source <git-url|path>  上流ソースを指定（既定: https://github.com/otoneko1102/blog.git）
  --dry-run                実際に書き換えずに差分（更新予定）を表示
  --no-backup             実更新時にバックアップを作成しない
  --install               実更新後に `npm install` を実行（lock更新も反映）
  -h, --help              ヘルプ表示

更新対象:
  - src/ と routes/ ディレクトリ（上流の同名ディレクトリで置換、削除も同期）
  - package.json, package-lock.json, vite.config.js（存在する場合は更新）

備考:
  - 上流が Git URL の場合は shallow clone（--depth=1）します。
  - 上流がローカルパスの場合はそのまま参照します。
  - --dry-run は rsync のドライランでファイル単位の差分一覧を表示します。
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)
      [[ $# -ge 2 ]] || { echo "--source requires a value"; exit 1; }
      UPSTREAM_URL="$2"; shift 2;;
    --dry-run)
      DO_DRY_RUN=true; shift;;
    --install)
      DO_INSTALL=true; shift;;
    --no-backup)
      DO_BACKUP=false; shift;;
    -h|--help)
      usage; exit 0;;
    *)
      echo "Unknown option: $1"; usage; exit 1;;
  esac
done

tmpdir=""
cleanup() {
  if [[ -n "$tmpdir" && -d "$tmpdir" ]]; then
    rm -rf "$tmpdir"
  fi
}
trap cleanup EXIT

# Resolve source path
SOURCE_DIR=""
if [[ -d "$UPSTREAM_URL" ]]; then
  SOURCE_DIR="$(cd "$UPSTREAM_URL" && pwd)"
else
  # Assume git URL
  command -v git >/dev/null 2>&1 || { echo "git not found"; exit 1; }
  tmpdir="$(mktemp -d)"
  echo "Cloning upstream... $UPSTREAM_URL -> $tmpdir"
  git clone --depth=1 "$UPSTREAM_URL" "$tmpdir" >/dev/null
  SOURCE_DIR="$tmpdir"
fi

echo "Upstream source: $SOURCE_DIR"
[[ -d "$SOURCE_DIR" ]] || { echo "Upstream source directory not found"; exit 1; }

declare -a DIRS=("src" "routes")
declare -a FILES=("vite.config.js")
declare -a PKG_FILES=("package.json" "package-lock.json")

RSYNC_BASE_ARGS=("-av" "--delete" "--exclude" ".git/" "--exclude" "node_modules/" "--exclude" "assets/img/")
RSYNC_DRY_ARGS=("--dry-run" "--info=NAME,DEL" "--human-readable")

# Backup
backup_dir=""
if $DO_BACKUP && ! $DO_DRY_RUN; then
  ts="$(date +%Y%m%d-%H%M%S)"
  backup_dir="$ROOT_DIR/private/backups/$ts"
  mkdir -p "$backup_dir"
  echo "Creating backup at: $backup_dir"
  for d in "${DIRS[@]}"; do
    if [[ -d "$ROOT_DIR/$d" ]]; then
      rsync -a "$ROOT_DIR/$d/" "$backup_dir/$d/"
    fi
  done
  for f in "${FILES[@]}"; do
    if [[ -f "$ROOT_DIR/$f" ]]; then
      cp -a "$ROOT_DIR/$f" "$backup_dir/$f"
    fi
  done
fi

update_dir() {
  local src_sub="$1"
  local upstream_path="$SOURCE_DIR/$src_sub"
  local local_path="$ROOT_DIR/$src_sub"

  if [[ ! -d "$upstream_path" ]]; then
    echo "[skip] upstream directory missing: $src_sub"
    return 0
  fi

  mkdir -p "$local_path"

  if $DO_DRY_RUN; then
    echo "[dry-run] syncing directory: $src_sub"
    rsync "${RSYNC_BASE_ARGS[@]}" "${RSYNC_DRY_ARGS[@]}" "$upstream_path/" "$local_path/"
  else
    echo "[apply] syncing directory: $src_sub"
    rsync "${RSYNC_BASE_ARGS[@]}" "$upstream_path/" "$local_path/"
  fi
}

update_file() {
  local fname="$1"
  local upstream_file="$SOURCE_DIR/$fname"
  local local_file="$ROOT_DIR/$fname"

  if [[ ! -f "$upstream_file" ]]; then
    echo "[skip] upstream file missing: $fname"
    return 0
  fi

  if $DO_DRY_RUN; then
    echo "[dry-run] comparing file: $fname"
    if [[ -f "$local_file" ]]; then
      diff -u "$local_file" "$upstream_file" || true
    else
      echo "(new) $fname will be added"
    fi
  else
    echo "[apply] updating file: $fname"
    install -m 0644 "$upstream_file" "$local_file"
  fi
}

update_pkg_file() {
  local fname="$1"
  local upstream_file="$SOURCE_DIR/$fname"
  local local_file="$ROOT_DIR/$fname"

  if [[ ! -f "$upstream_file" ]]; then
    echo "[skip] upstream file missing: $fname"
    return 0
  fi

  # Extract current local name field(s)
  local local_name=""
  local local_pkg_name=""
  if [[ -f "$local_file" ]]; then
    if command -v jq >/dev/null 2>&1; then
      local_name=$(jq -r '.name' "$local_file" 2>/dev/null || echo "")
      # For package-lock.json, also get packages[""].name
      if [[ "$fname" == "package-lock.json" ]]; then
        local_pkg_name=$(jq -r '.packages[""].name' "$local_file" 2>/dev/null || echo "")
      fi
    else
      # Fallback: use grep/sed
      local_name=$(grep -oP '^\s*"name"\s*:\s*"\K[^"]+' "$local_file" 2>/dev/null | head -1 || echo "")
    fi
  fi

  if $DO_DRY_RUN; then
    echo "[dry-run] comparing file: $fname (preserving name field)"
    if [[ -f "$local_file" ]]; then
      diff -u "$local_file" "$upstream_file" || true
      if [[ -n "$local_name" ]]; then
        echo "(note: local name '$local_name' will be preserved)"
      fi
    else
      echo "(new) $fname will be added"
    fi
  else
    echo "[apply] updating file: $fname (preserving name field)"
    install -m 0644 "$upstream_file" "$local_file"
    
    # Restore local name if it exists
    if [[ -n "$local_name" ]]; then
      if command -v jq >/dev/null 2>&1; then
        # Use jq to update name field(s)
        if [[ "$fname" == "package-lock.json" && -n "$local_pkg_name" ]]; then
          # Update both .name and .packages[""].name
          jq --arg name "$local_name" --arg pkgname "$local_pkg_name" \
             '.name = $name | .packages[""].name = $pkgname' \
             "$local_file" > "$local_file.tmp"
          mv "$local_file.tmp" "$local_file"
          echo "  -> Restored local name: $local_name (root and packages[\"\"])"
        else
          # Update only .name
          jq --arg name "$local_name" '.name = $name' "$local_file" > "$local_file.tmp"
          mv "$local_file.tmp" "$local_file"
          echo "  -> Restored local name: $local_name"
        fi
      else
        # Fallback: use sed (only handles first occurrence)
        sed -i "0,/\"name\"[[:space:]]*:[[:space:]]*\"[^\"]*\"/s//\"name\": \"$local_name\"/" "$local_file"
        echo "  -> Restored local name: $local_name"
      fi
    fi
  fi
}

# Process directories
for d in "${DIRS[@]}"; do
  update_dir "$d"
done

# Process files
for f in "${FILES[@]}"; do
  update_file "$f"
done

# Process package files (preserving name field)
for f in "${PKG_FILES[@]}"; do
  update_pkg_file "$f"
done

if ! $DO_DRY_RUN && $DO_INSTALL; then
  echo "Running npm install to update lockfile and dependencies..."
  (cd "$ROOT_DIR" && npm install)
fi

echo "Done."
