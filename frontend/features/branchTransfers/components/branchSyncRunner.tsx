"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { isTerminal, useDeviceConfig } from "@/lib/device";
import { planKey } from "@/lib/plan";

import { syncCatalogNow } from "../api/branchTransfers.api";
import { branchKeys } from "../hooks/useBranchTransfers";

const EVERY_MS = 60_000;
const IDLE_MS = 5 * 60_000; // الجهاز مش مربوط: نفحص على فترات أطول
const FIRST_MS = 5_000;

/**
 * مزامنة الأصناف والعملاء مع باقي الفروع في الخلفية (الجهاز الأساسي فقط). الخطة تُفحص في الـ backend
 * بعد تجديد شهادة الفرع، فجهاز فرع على الخطة المجانية يرث «سلسلة» من هنا.
 * يمر عبر الـ backend بتصريح الكتابة، فيحترم الترخيص. أي خطأ صامت هنا: الحالة تظهر في الإعدادات.
 */
export function BranchSyncRunner() {
  const device = useDeviceConfig();
  const qc = useQueryClient();
  const main = device !== null && !isTerminal(device);

  useEffect(() => {
    // بدون شرط الخطة: جهاز الفرع يرث خطة المحل من هذه المزامنة نفسها (شهادة الفرع).
    if (!main) return;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;

    const tick = async () => {
      let next = EVERY_MS;
      try {
        const s = await syncCatalogNow();
        if (!s.connected) next = IDLE_MS;
        qc.setQueryData(branchKeys.catalog(), s);
        // الخطة قد تتغير مع شهادة الفرع (ورث «سلسلة» أو انتهت): نحدّث القفل في الواجهة.
        void qc.invalidateQueries({ queryKey: planKey });
      } catch {
        next = EVERY_MS * 2; // ترخيص/شبكة: نحاول لاحقاً بهدوء
      }
      if (!stopped) timer = setTimeout(tick, next);
    };

    timer = setTimeout(tick, FIRST_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [main, qc]);

  return null;
}
