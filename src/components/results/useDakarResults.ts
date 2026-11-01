"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DakarResponse } from "@/lib/results/dakar/types";
import { isDakarResponse } from "./dakarDisplay";

type State = { data: DakarResponse | null; loading: boolean; error: string | null };

/** Both polling and manual refresh read our public cache, never the official feed. */
export function useDakarResults() {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null });
  const generation = useRef(0);
  const readRef = useRef<(() => void) | null>(null);
  const refresh = useCallback(() => { readRef.current?.(); }, []);

  useEffect(() => {
    const current = ++generation.current;
    let controller: AbortController | null = null;
    let requestTimeout: number | undefined;
    let pending = false;
    async function read() {
      if (pending) return;
      pending = true;
      const request = new AbortController();
      controller = request;
      let timedOut = false;
      requestTimeout = window.setTimeout(() => { timedOut = true; request.abort(); }, 20_000);
      setState((previous) => ({ ...previous, loading: true, error: null }));
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data/index.json`, { signal: request.signal, cache: "no-store", credentials: "omit" });
        if (!response.ok) throw new Error("暫時無法讀取達卡賽果，請稍後重試。");
        const data: unknown = await response.json();
        if (!isDakarResponse(data)) throw new Error("達卡賽果資料格式異常，請稍後重試。");
        if (generation.current === current && !request.signal.aborted) setState({ data, loading: false, error: null });
      } catch (error) {
        if (generation.current === current && (!request.signal.aborted || timedOut)) setState((previous) => ({ ...previous, loading: false, error: timedOut ? "讀取達卡賽果逾時，請重新讀取重試。" : error instanceof Error ? error.message : "暫時無法讀取達卡賽果，請稍後重試。" }));
      } finally {
        window.clearTimeout(requestTimeout);
        requestTimeout = undefined;
        pending = false;
      }
    }
    readRef.current = () => { void read(); };
    void read();
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void read(); }, 60_000);
    return () => { generation.current += 1; controller?.abort(); readRef.current = null; window.clearInterval(interval); window.clearTimeout(requestTimeout); };
  }, []);
  return { ...state, refresh };
}
