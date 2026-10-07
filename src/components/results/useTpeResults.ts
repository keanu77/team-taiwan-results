"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TpeResultsResponse } from "@/lib/results/types";
import { isResultsDate, isResultsResponse } from "./resultDisplay";
import { loadResults } from "./staticData";

interface ResultsState {
  key: string;
  data: TpeResultsResponse | null;
  loading: boolean;
  error: string | null;
}

const CACHE_READ_INTERVAL_MS = 60_000;
/** 已封存或手動更新的賽事不會每 30 分鐘變動，降到 10 分鐘讀一次（與 GitHub Pages 快取相同） */
const IDLE_READ_INTERVAL_MS = 10 * 60_000;

/** 只讀取已同步的靜態檔，不會觸發向官方抓取。 */
export function useTpeResults(date: string, period = false) {
  const [state, setState] = useState<ResultsState>({ key: "", data: null, loading: false, error: null });
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const idle = useRef(false);
  const lastRead = useRef(0);
  const nextReadAt = useRef(0);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [refreshInSeconds, setRefreshInSeconds] = useState(0);
  const enabled = isResultsDate(date);
  const requestKey = `${period ? "period" : "day"}:${date}`;
  const refresh = useCallback(() => {
    if (!enabled || Date.now() < nextReadAt.current) return;
    nextReadAt.current = Date.now() + CACHE_READ_INTERVAL_MS;
    setCooldownUntil(nextReadAt.current);
    setRetry((value) => value + 1);
  }, [enabled]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      const seconds = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setRefreshInSeconds(seconds);
      if (seconds > 0) timer = setTimeout(update, 1000);
    };
    update();
    return () => { if (timer) clearTimeout(timer); };
  }, [cooldownUntil]);

  useEffect(() => {
    if (!enabled) return;
    const current = ++generation.current;
    let controller: AbortController | null = null;
    let pending = false;

    async function read() {
      if (pending) return;
      pending = true;
      controller = new AbortController();
      const request = controller;
      setState((previous) => ({ key: requestKey, data: previous.key === requestKey ? previous.data : null, loading: true, error: null }));
      try {
        const data: unknown = await loadResults(date, period, request.signal);
        if (!isResultsResponse(data, date, period)) throw new Error("賽果資料格式異常，請稍後重試。");
        if (generation.current === current && !request.signal.aborted) {
          lastRead.current = Date.now();
          idle.current = data.nextSyncAt === null && data.fetchedAt !== null;
          setState({ key: requestKey, data, loading: false, error: null });
        }
      } catch (error) {
        if (generation.current === current && !request.signal.aborted) {
          setState((previous) => ({ key: requestKey, data: previous.key === requestKey ? previous.data : null, loading: false, error: error instanceof Error ? error.message : "暫時無法讀取賽果，請稍後重試。" }));
        }
      } finally {
        pending = false;
      }
    }

    void read();
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      // 沒有下一次排程同步（已封存或手動更新）就放慢
      if (idle.current && Date.now() - lastRead.current < IDLE_READ_INTERVAL_MS) return;
      void read();
    }, CACHE_READ_INTERVAL_MS);
    return () => {
      generation.current += 1;
      controller?.abort();
      window.clearInterval(interval);
    };
  }, [date, enabled, retry, period, requestKey]);

  const current = state.key === requestKey ? state : { key: requestKey, data: null, loading: enabled, error: null };
  return { ...current, refresh, enabled, refreshInSeconds, refreshKey: retry };
}
