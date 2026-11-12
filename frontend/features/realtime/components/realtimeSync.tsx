"use client";

import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useEffect } from "react";

import {
  REALTIME_EVENT,
  startRealtime,
  type RealtimeDetail,
  type RealtimeTopic,
} from "@/lib/realtime";

/** موضوع تغيّر على السيرفر ← الاستعلامات التي تعرضه (الجذر يكفي: يشمل كل الفروع). */
const TOPIC_QUERIES: Record<RealtimeTopic, QueryKey[]> = {
  products: [
    ["products"],
    ["inventory"],
    ["pos", "catalog"],
    ["purchases"],
    ["purchase-orders"],
    ["reports"],
    ["dashboard"],
  ],
  customers: [["customers"], ["pos", "catalog"], ["reports"], ["dashboard"]],
  sales: [
    ["sales"],
    ["purchase-orders", "suggestions"],
    ["pos", "catalog"],
    ["inventory"],
    ["shifts"],
    ["treasury"],
    ["reports"],
    ["dashboard"],
  ],
  held: [], // المعلّقة في الـ store (usePosPersistence يستمع لها)
  shifts: [["shifts"], ["treasury"], ["dashboard"]],
  treasury: [["treasury"], ["shifts"], ["reports"], ["dashboard"]],
  expenses: [
    ["expenses"],
    ["treasury"],
    ["shifts"],
    ["reports"],
    ["dashboard"],
  ],
  purchases: [
    ["purchases"],
    ["purchase-orders"],
    ["suppliers"],
    ["inventory"],
    ["products"],
    ["treasury"],
    ["reports"],
    ["dashboard"],
  ],
  suppliers: [["suppliers"], ["purchases"], ["reports"]],
  users: [["users"], ["audit"]],
  settings: [["settings"], ["shop"], ["plan"]],
  devices: [["devices"]],
};

/** تغييرات متتالية (بيع واحد = عدة معاملات) تُجمع في إعادة جلب واحدة. */
const DEBOUNCE_MS = 250;

/**
 * يُركّب مرة داخل الشاشات المحمية (بعد الدخول): يفتح البث اللحظي ويحدّث الاستعلامات المعروضة.
 * invalidate يعيد جلب المعروض الآن فقط؛ الباقي يُعلَّم قديماً ويُجلب عند فتحه.
 */
export function RealtimeSync() {
  const qc = useQueryClient();

  useEffect(() => {
    const stop = startRealtime();
    const pending = new Set<RealtimeTopic>();
    let all = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const flush = () => {
      if (all) {
        void qc.invalidateQueries();
      } else {
        const keys = new Map<string, QueryKey>();
        for (const t of pending)
          for (const k of TOPIC_QUERIES[t] ?? [])
            keys.set(JSON.stringify(k), k);
        for (const k of keys.values())
          void qc.invalidateQueries({ queryKey: k });
      }
      pending.clear();
      all = false;
    };

    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<RealtimeDetail>).detail;
      if (detail === "*") all = true;
      else detail.forEach((t) => pending.add(t));
      clearTimeout(timer);
      timer = setTimeout(flush, DEBOUNCE_MS);
    };

    window.addEventListener(REALTIME_EVENT, onChange);
    return () => {
      window.removeEventListener(REALTIME_EVENT, onChange);
      clearTimeout(timer);
      stop();
    };
  }, [qc]);

  return null;
}
