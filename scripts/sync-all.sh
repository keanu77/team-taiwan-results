#!/bin/bash
# 依序同步 events/ 底下每個賽事（各自寫到 data/<代號>/）。不在賽期內的賽事會直接跳過、不打官網。
# 一個賽事失敗不影響其他賽事；最後只要有失敗就回傳非 0。
# SYNC_TOTAL_BUDGET_MINUTES：所有賽事合計最多花多久（預設 30），後面的賽事拿剩下的時間。
set -uo pipefail

total="${SYNC_TOTAL_BUDGET_MINUTES:-30}"
started="$(date +%s)"
status=0
root="${EVENTS_DIR:-events}"
for dir in "$root"/*/; do
  id="$(basename "$dir")"
  [[ "$id" =~ ^[a-z0-9][a-z0-9-]{1,39}$ ]] && [ -f "$dir/competition.config.json" ] || continue
  left=$(( total - ($(date +%s) - started) / 60 ))
  if [ "$left" -lt 2 ]; then
    echo "== ${id}：本輪時間用完，下一輪再同步"
    continue
  fi
  echo "== ${id}（剩 ${left} 分鐘）"
  EVENT="$id" SYNC_BUDGET_MINUTES="$left" npm run -s sync || status=1
done
exit "$status"
