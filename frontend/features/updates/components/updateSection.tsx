"use client";

import {
  IconCircleCheckFilled,
  IconDownload,
  IconLoader2,
  IconRefresh,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  appVersion,
  checkForUpdate,
  updatesSupported,
  useUpdateState,
} from "@/lib/updater";

import { openUpdateDialog } from "./updateRuntime";

/** قسم «تحديث البرنامج» في الإعدادات: النسخة الحالية + فحص يدوي. */
export function UpdateSection() {
  const state = useUpdateState();
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    void appVersion().then(setVersion);
  }, []);

  if (!updatesSupported()) {
    return (
      <p className="text-xs text-muted-foreground">
        التحديث التلقائي متاح في نسخة سطح المكتب فقط.
      </p>
    );
  }

  const checking = state.status === "checking";
  const hasUpdate =
    state.status === "available" ||
    state.status === "downloading" ||
    state.status === "installing" ||
    (state.status === "error" && !!state.update);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="space-y-1 text-xs">
        <p>
          الإصدار الحالي:{" "}
          <span dir="ltr" className="font-mono font-semibold">
            {version ?? "—"}
          </span>
        </p>
        {state.status === "latest" && (
          <p className="flex items-center gap-1 text-success">
            <IconCircleCheckFilled className="size-4" />
            البرنامج محدّث لآخر إصدار.
          </p>
        )}
        {hasUpdate && "update" in state && state.update && (
          <p className="font-medium text-primary">
            الإصدار {state.update.version} متاح للتحديث.
          </p>
        )}
        {state.status === "error" && !state.update && (
          <p className="text-destructive">{state.message}</p>
        )}
        {!hasUpdate && state.status !== "error" && (
          <p className="text-muted-foreground">
            البرنامج يبحث عن التحديثات تلقائياً، ولن يُثبّت أي شيء بدون موافقتك.
          </p>
        )}
      </div>

      {hasUpdate ? (
        <Button onClick={openUpdateDialog} className="gap-2">
          <IconDownload className="size-4" />
          عرض التحديث
        </Button>
      ) : (
        <Button
          variant="outline"
          disabled={checking}
          onClick={() => void checkForUpdate()}
          className="gap-2"
        >
          {checking ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconRefresh className="size-4" />
          )}
          {checking ? "جارٍ البحث…" : "البحث عن تحديث"}
        </Button>
      )}
    </div>
  );
}
