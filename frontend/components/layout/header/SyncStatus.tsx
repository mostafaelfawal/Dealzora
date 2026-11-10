"use client";

import {
  IconCloudUpload,
  IconDatabaseExport,
  IconLoader2,
} from "@tabler/icons-react";

import { StatusDot, type StatusTone } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
    description: "بياناتك محفوظة في نسخة احتياطية مشفّرة",
  },
  syncing: {
    tone: "warning",
    pulse: true,
    description: "يتم رفع التغييرات الأخيرة",
  },
  offline: {
    tone: "neutral",
    pulse: false,
    description:
      "تعذّر الاتصال بالخادم المحلي. أعد تشغيل البرنامج لو استمرت المشكلة",
  },
  error: {
    tone: "danger",
    pulse: false,
    description: "مرّ وقت طويل على آخر نسخة احتياطية. أنشئ نسخة الآن",
  },
};

interface SyncStatusProps {
  sync: SyncState;
  showLabels?: boolean;
  onBackup?: () => void;
}

export function SyncStatus({
  sync,
  showLabels = false,
  onBackup,
}: SyncStatusProps) {
  const now = useNow(30_000);
  const { tone, pulse, description } = STATUS_CONFIG[sync.status];

  const isSyncing = sync.status === "syncing";
  const isOffline = sync.status === "offline";

  const label = (() => {
    switch (sync.status) {
      case "synced":
        if (!sync.lastSyncedAt) return "لا توجد نسخة بعد";
        return now === null
          ? "آخر نسخة احتياطية"
          : `آخر نسخة ${formatMinutesAgo(sync.lastSyncedAt, now)}`;
      case "syncing":
        return "جارٍ النسخ الاحتياطي";
      case "offline":
        return "غير متصل";
      case "error":
        return "النسخة الاحتياطية قديمة";
    }
  })();

  const lastBackupText =
    sync.lastSyncedAt && now !== null
      ? formatMinutesAgo(sync.lastSyncedAt, now)
      : "لا توجد نسخة احتياطية بعد";

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="lg"
            className="gap-2 px-2 font-normal"
          />
        }
      >
        <StatusDot tone={tone} pulse={pulse} />
        <span
          className={cn("text-sm", !showLabels && "sr-only 2xl:not-sr-only")}
        >
          {label}
        </span>
        {!showLabels && (
          <IconCloudUpload className="size-4 text-muted-foreground 2xl:hidden" />
        )}
      </PopoverTrigger>

      <PopoverContent align="end" className="w-64">
        <div className="space-y-1">
          <p className="text-sm font-medium">آخر نسخة احتياطية</p>
          <p className="text-sm text-muted-foreground" suppressHydrationWarning>
            {lastBackupText}
          </p>
          {sync.status !== "synced" && (
            <p className="pt-1 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {onBackup && (
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            disabled={isSyncing || isOffline}
            onClick={onBackup}
          >
            {isSyncing ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : (
              <IconDatabaseExport className="size-4" />
            )}
            {isSyncing ? "جارٍ النسخ الاحتياطي..." : "إنشاء نسخة احتياطية"}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
