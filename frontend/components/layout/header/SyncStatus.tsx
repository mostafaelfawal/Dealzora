"use client";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { StatusDot, type StatusTone } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/useNow";
import { formatMinutesAgo } from "@/lib/format";
import type { SyncState, SyncStatusType } from "@/types/shell";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<
  SyncStatusType,
  { tone: StatusTone; pulse: boolean; description: string }
> = {
  synced: {
    tone: "success",
    pulse: false,
    description: "بياناتك محفوظة في السحابة",
  },
  syncing: {
    tone: "warning",
    pulse: true,
    description: "بيتم رفع التغييرات الأخيرة",
  },
  offline: {
    tone: "neutral",
    pulse: false,
    description: "مفيش اتصال بالإنترنت. الشغل بيتحفظ على الجهاز ويترفع بعدين",
  },
  error: {
    tone: "danger",
    pulse: false,
    description: "فشل النسخ الاحتياطي. تأكد من الاتصال وحاول تاني",
  },
};

interface SyncStatusProps {
  sync: SyncState;
  showLabels?: boolean;
}

export function SyncStatus({ sync, showLabels = false }: SyncStatusProps) {
  const now = useNow(30_000);
  const { tone, pulse, description } = STATUS_CONFIG[sync.status];

  const label = (() => {
    switch (sync.status) {
      case "synced":
        return now === null
          ? "آخر نسخة احتياطية"
          : `آخر نسخة ${formatMinutesAgo(sync.lastSyncedAt, now)}`;
      case "syncing":
        return "جارٍ النسخ الاحتياطي";
      case "offline":
        return "غير متصل";
      case "error":
        return "تعذّر النسخ الاحتياطي";
    }
  })();

  return (
    <AppTooltip message={description}>
      <Button variant="ghost" size="lg" className="gap-2 px-2 font-normal">
        <StatusDot tone={tone} pulse={pulse} />
        <span
          className={cn("text-sm", !showLabels && "sr-only 2xl:not-sr-only")}
        >
          {label}
        </span>
      </Button>
    </AppTooltip>
  );
}
