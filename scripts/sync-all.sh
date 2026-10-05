#!/bin/bash
# 依序同步 events/ 底下每個賽事（各自寫到 data/<代號>/）。不在賽期內的賽事會直接跳過、不打官網。
# 一個賽事失敗不影響其他賽事；最後只要有失敗就回傳非 0，讓 workflow 標紅。
set -uo pipefail

# workflow 用：先寫預設值，任何賽事有變動時 sync.ts 會再寫 changed=true（後寫的生效）
if [ -n "${GITHUB_OUTPUT:-}" ]; then echo "changed=false" >> "$GITHUB_OUTPUT"; fi

status=0
for dir in events/*/; do
  id="$(basename "$dir")"
  [[ "$id" =~ ^[a-z0-9][a-z0-9-]{1,39}$ ]] && [ -f "$dir/competition.config.json" ] || continue
  echo "== $id"
  EVENT="$id" npm run -s sync || status=1
done
exit "$status"
