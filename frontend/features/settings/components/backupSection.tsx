"use client";

import { IconDatabaseExport, IconLoader2 } from "@tabler/icons-react";

import { listItem, MotionLi } from "@/components/shared/motion";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/useNow";
import { formatWhen } from "@/lib/dates";
import { formatMinutesAgo } from "@/lib/format";

import type { BackupFile, BackupStatus } from "../api/settings.api";
import { BACKUP_LIST_LIMIT } from "../config/settingsOptions";
import {
  useBackups,
  useBackupStatus,
  useCreateBackup,
} from "../hooks/useSettings";
import { formatFileSize } from "../lib/settingsFormat";

const DEFAULTS = { autoEveryHours: 24, keep: 14 };

function BackupInfo({ status: s }: { status: BackupStatus | undefined }) {
  const now = useNow(30_000);
  return (
    <div className="min-w-0 flex-1 text-xs">
      <p>
        آخر نسخة:{" "}
        <span className="font-medium">
          {s?.lastBackupAt && now
            ? formatMinutesAgo(s.lastBackupAt, now)
            : "لا توجد بعد"}
        </span>
      </p>
      <p className="text-muted-foreground">
        نسخة تلقائية كل {s?.autoEveryHours ?? DEFAULTS.autoEveryHours} ساعة عند
        تشغيل البرنامج، ونحتفظ بآخر {s?.keep ?? DEFAULTS.keep} نسخة. كل نسخة
        مشفّرة بنفس مفتاح قاعدة البيانات.
      </p>
      {s && s.pendingSync > 0 && (
        <p className="text-muted-foreground">
          {s.pendingSync} تغيير بانتظار الرفع للسحابة عند ربط الحساب.
        </p>
      )}
    </div>
  );
}

function BackupList({ files }: { files: BackupFile[] }) {
  return (
    <ul className="divide-y border text-xs">
      {files.slice(0, BACKUP_LIST_LIMIT).map((b, i) => (
        <MotionLi
          key={b.name}
          {...listItem(i)}
          className="flex items-center justify-between gap-3 px-3 py-2"
        >
          <span dir="ltr" className="truncate font-mono">
            {b.name}
          </span>
          <span className="shrink-0 text-muted-foreground">
            {formatWhen(b.createdAt)} · {formatFileSize(b.size)}
          </span>
        </MotionLi>
      ))}
    </ul>
  );
}

export function BackupSection() {
  const status = useBackupStatus();
  const backups = useBackups();
  const create = useCreateBackup();
  const files = backups.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <BackupInfo status={status.data} />
        <Button
          size="lg"
          onClick={() => create.mutate()}
          disabled={create.isPending}
          className="gap-2"
        >
          {create.isPending ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconDatabaseExport className="size-4" />
          )}
          نسخة احتياطية الآن
        </Button>
      </div>
      {files.length > 0 && <BackupList files={files} />}
    </div>
  );
}
