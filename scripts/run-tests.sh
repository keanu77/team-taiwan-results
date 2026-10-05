#!/bin/sh
set -eu

# 專案刻意不引入額外 test runner；用既有 TypeScript 編譯器把輕量檢查
# 連同被測模組編到隔離的暫存目錄，再交給 Node 執行。
# 測試用固定的範例賽事（tests/fixtures/events），使用者刪改自己的 events/ 不會讓測試變紅
EVENTS_DIR=tests/fixtures/events EVENT=ag2026 npx tsx scripts/prepare-event.ts

TEST_BUILD_DIR="$(mktemp -d "${TMPDIR:-/tmp}/results-tests.XXXXXX")"
trap 'rm -rf "$TEST_BUILD_DIR"' EXIT HUP INT TERM

npx tsc \
  --module commonjs \
  --moduleResolution node \
  --target es2022 \
  --esModuleInterop \
  --resolveJsonModule \
  --skipLibCheck \
  --rootDir . \
  --outDir "$TEST_BUILD_DIR" \
  --noEmit false \
  --incremental false \
  tests/*.check.ts

status=0
for test_file in "$TEST_BUILD_DIR"/tests/*.check.js; do
  node "$test_file" || status=1
done

node --test tests/*.test.mjs || status=1

exit "$status"
