#!/bin/bash
# 建置整個網站到 site/：每個賽事一個子目錄（site/<代號>/），首頁是賽事列表。
# BASE_PATH 是網站在網域下的路徑（GitHub Pages 為 /<repo 名稱>），本機留空。
set -euo pipefail

ROOT_BASE="${BASE_PATH:-}"
SITE_DIR="${SITE_DIR:-site}"
rm -rf "$SITE_DIR"
mkdir -p "$SITE_DIR"

events=()
for dir in events/*/; do
  id="$(basename "$dir")"
  [[ "$id" =~ ^[a-z0-9][a-z0-9-]{1,39}$ ]] && [ -f "$dir/competition.config.json" ] || continue
  events+=("$id")
done
if [ "${#events[@]}" -eq 0 ]; then echo "events/ 底下沒有任何賽事" >&2; exit 1; fi

for id in "${events[@]}"; do
  echo "== 建置 $id"
  EVENT="$id" BASE_PATH="$ROOT_BASE/$id" npm run -s build
  cp -R out "$SITE_DIR/$id"
done

node scripts/build-index.mjs "$SITE_DIR" "${events[@]}"
echo "== 完成：$SITE_DIR/（${#events[@]} 個賽事）"
