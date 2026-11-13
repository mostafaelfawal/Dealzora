"use client";

import {
  IconAlertTriangle,
  IconCloudOff,
  IconLoader2,
  IconRefresh,
  IconUsers,
  IconPackage,
} from "@tabler/icons-react";

import { Num } from "@/components/shared/Num";
import { Button } from "@/components/ui/button";
import { formatWhen } from "@/lib/dates";
import { isTerminal, useDeviceConfig } from "@/lib/device";

import {
  useCatalogStatus,
  useSyncCatalogNow,
} from "../hooks/useBranchTransfers";

/** حالة مزامنة الأصناف والعملاء مع باقي الفروع + «مزامنة الآن» + السجلات اللي فشلت. */
export function CatalogSyncCard() {
  const q = useCatalogStatus(true);
  const sync = useSyncCatalogNow();
  const device = useDeviceConfig();
  const main = device !== null && !isTerminal(device);
  const s = q.data;

  return (
    <div className="space-y-3 border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">مزامنة الأصناف والعملاء</p>
          <p className="text-xs text-muted-foreground">
            الأسماء والباركود والأسعار والعملاء بيتوحدوا بين كل الفروع تلقائياً
            كل دقيقة. المخزون والتكلفة وديون العملاء ونقاطهم بتفضل خاصة بكل فرع.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={!main || sync.isPending}
          title={main ? undefined : "من الجهاز الأساسي فقط"}
          onClick={() => sync.mutate()}
        >
          {sync.isPending ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconRefresh className="size-4" />
          )}
          مزامنة الآن
        </Button>
      </div>

      {s && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <IconPackage className="size-3.5" /> <Num>{s.products}</Num> صنف
            متزامن
          </span>
          <span className="flex items-center gap-1">
            <IconUsers className="size-3.5" /> <Num>{s.customers}</Num> عميل
            متزامن
          </span>
          <span>
            آخر مزامنة:{" "}
            {s.lastSyncAt ? formatWhen(Date.parse(s.lastSyncAt)) : "لسه"}
          </span>
        </div>
      )}

      {s?.lastError && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <IconCloudOff className="size-3.5 shrink-0" /> {s.lastError}
        </p>
      )}

      {s && s.errorCount > 0 && (
        <div className="space-y-1.5 border border-warning/40 bg-warning/5 p-2.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
            <IconAlertTriangle className="size-4" />
            {s.errorCount} سجل ما اتزامنش. عدّله وهيتزامن تلقائياً:
          </p>
          <ul className="space-y-1 text-xs">
            {s.errors.map((e, i) => (
              <li key={`${e.localId ?? e.name}-${i}`}>
                <b>
                  {e.kind === "product" ? "صنف" : "عميل"} «{e.name}»
                </b>
                <span className="text-muted-foreground">: {e.error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
