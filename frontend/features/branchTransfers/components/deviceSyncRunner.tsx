"use client";

import { useEffect } from "react";

import { isTerminal, useDeviceConfig } from "@/lib/device";

import { deviceSync } from "../api/branchTransfers.api";

const EVERY_MS = 30_000;
const FIRST_MS = 1_000;

/**
 * على شاشة الدخول (لا أحد مسجّل): مزامنة على مستوى الجهاز، فحساب موظف أنشأه المالك من جهازه
 * يصل للفرع ويقدر يدخل فوراً. الجهاز الأساسي للفرع فقط، وأي خطأ صامت (الجهاز غير مربوط مثلاً).
 */
export function DeviceSyncRunner() {
  const device = useDeviceConfig();
  const main = device !== null && !isTerminal(device);

  useEffect(() => {
    if (!main) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      let next = EVERY_MS;
      try {
        const r = await deviceSync();
        if (!r.connected) next = EVERY_MS * 4; // غير مربوط بسيرفر الفروع: نفحص على فترات أطول
      } catch {
        next = EVERY_MS * 2;
      }
      if (!stopped) timer = setTimeout(tick, next);
    };
    timer = setTimeout(tick, FIRST_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [main]);

  return null;
}
