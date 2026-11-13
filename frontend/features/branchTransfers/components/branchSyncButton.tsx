"use client";

import { IconArrowsExchange, IconLoader2 } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/useNow";
import { isTerminal, useDeviceConfig } from "@/lib/device";
import { formatMinutesAgo } from "@/lib/format";
import { planKey } from "@/lib/plan";

import {
  branchKeys,
  useBranchStatus,
  useCatalogStatus,
  useSyncCatalogNow,
} from "../hooks/useBranchTransfers";

/**
 * زر «مزامنة الفروع» في الشريط العلوي (بجانب النسخ الاحتياطي): يظهر فقط لجهاز مربوط بسيرفر الفروع.
 * يسحب الأصناف والعملاء والموظفين ويرفع تعديلاتنا، ويعيد إرسال التحويلات المعلّقة، ويجدد شهادة الفرع.
 */
export function BranchSyncButton({
  showLabel = false,
}: {
  showLabel?: boolean;
}) {
  const device = useDeviceConfig();
  const main = device !== null && !isTerminal(device);
  const status = useBranchStatus();
  const connected = Boolean(status.data?.connected);
  const catalog = useCatalogStatus(main && connected);
  const sync = useSyncCatalogNow();
  const qc = useQueryClient();
  const now = useNow(30_000);

  if (!main || !connected) return null;

  const c = catalog.data;
  const failed = Boolean(c?.lastError) || (c?.errorCount ?? 0) > 0;
  const last =
    c?.lastSyncAt && now !== null
      ? `آخر مزامنة ${formatMinutesAgo(Date.parse(c.lastSyncAt), now)}`
      : "لم تتم مزامنة بعد";
  const message = sync.isPending
    ? "جارٍ المزامنة مع الفروع…"
    : c?.lastError
      ? `مزامنة الفروع: ${c.lastError}`
      : (c?.errorCount ?? 0) > 0
        ? `مزامنة الفروع · ${c?.errorCount} سجل لم يتزامن (التفاصيل في الإعدادات)`
        : `مزامنة الفروع الآن · ${last}`;

  function run() {
    sync.mutate(undefined, {
      onSettled: () => {
        // ما تغيّر بالمزامنة: الخطة الموروثة، والتحويلات الواردة، وحالة الربط
        void qc.invalidateQueries({ queryKey: planKey });
        void qc.invalidateQueries({ queryKey: branchKeys.all });
      },
    });
  }

  return (
    <AppTooltip message={message}>
      <Button
        variant="ghost"
        size="lg"
        className="relative gap-2 px-2 font-normal"
        aria-label="مزامنة الفروع الآن"
        disabled={sync.isPending}
        onClick={run}
      >
        {sync.isPending ? (
          <IconLoader2 className="size-4 animate-spin text-muted-foreground" />
        ) : (
          <IconArrowsExchange className="size-4 text-muted-foreground" />
        )}
        <span
          className={
            showLabel ? "text-sm" : "sr-only 2xl:not-sr-only 2xl:text-sm"
          }
        >
          مزامنة الفروع
        </span>
        {failed && !sync.isPending && (
          <span className="absolute top-1.5 inset-e-1.5">
            <StatusDot tone="danger" pulse={false} />
          </span>
        )}
      </Button>
    </AppTooltip>
  );
}
