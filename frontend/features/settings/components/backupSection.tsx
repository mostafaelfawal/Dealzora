"use client";

import {
  IconAlertTriangle,
  IconDatabaseExport,
  IconFolder,
  IconFolderOpen,
  IconHistory,
  IconLoader2,
  IconRestore,
} from "@tabler/icons-react";
import { useState } from "react";

import { listItem, MotionLi } from "@/components/shared/motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNow } from "@/hooks/useNow";
import { formatWhen } from "@/lib/dates";
import { formatMinutesAgo } from "@/lib/format";

import type {
  BackupFile,
  BackupLocation,
  BackupStatus,
} from "../api/settings.api";
import { BACKUP_LIST_LIMIT } from "../config/settingsOptions";
import {
  useBackups,
  useBackupStatus,
  useCreateBackup,
  useSetBackupLocation,
} from "../hooks/useSettings";
import { canPickPath, pickFolder } from "../lib/pickPath";
import { formatFileSize } from "../lib/settingsFormat";
import { RestoreDialog, type RestoreSource } from "./restoreDialog";

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

/* ---------- مكان الحفظ ---------- */

function LocationEditor({ location }: { location: BackupLocation }) {
  const save = useSetBackupLocation();
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? location.configured ?? location.path;
  const picker = canPickPath();

  async function browse() {
    const picked = await pickFolder(value);
    if (picked) setDraft(picked);
  }

  const dirty =
    draft !== null && draft.trim() !== (location.configured ?? location.path);

  return (
    <div className="space-y-2 border-t pt-3">
      <Label htmlFor="backup-dir" className="flex items-center gap-1.5">
        <IconFolder className="size-4" />
        مكان حفظ النسخ
      </Label>

      {location.fallback && (
        <p role="alert" className="flex items-start gap-2 text-xs text-warning">
          <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            المجلد المحدد{" "}
            <bdi dir="ltr" className="font-mono">
              {location.configured}
            </bdi>{" "}
            غير متاح الآن (فلاشة أو قرص مفصول؟). النسخ تُحفظ مؤقتاً في المجلد
            الافتراضي حتى يرجع.
          </span>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Input
          id="backup-dir"
          dir="ltr"
          value={value}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="D:\Dealzora-Backups"
          readOnly={picker}
          onClick={picker ? browse : undefined}
          className="h-10 min-w-56 flex-1 cursor-default font-mono text-xs"
        />
        {picker && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={browse}
            className="h-10 gap-2 font-normal"
          >
            <IconFolderOpen className="size-4" />
            اختيار مجلد…
          </Button>
        )}
        <Button
          type="button"
          size="lg"
          disabled={!dirty || !value.trim() || save.isPending}
          onClick={() =>
            save.mutate(value.trim(), { onSuccess: () => setDraft(null) })
          }
          className="h-10 gap-2"
        >
          {save.isPending && <IconLoader2 className="size-4 animate-spin" />}
          حفظ المكان
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>
          {location.isDefault && !location.fallback
            ? "المجلد الافتراضي بجانب قاعدة البيانات."
            : "الأفضل قرص آخر غير قرص النظام (D: مثلاً) أو فلاشة، حتى لا تضيع النسخ لو تعطّل الجهاز."}
        </span>
        {!location.isDefault || location.fallback ? (
          <Button
            type="button"
            variant="link"
            size="sm"
            disabled={save.isPending}
            onClick={() =>
              save.mutate(null, { onSuccess: () => setDraft(null) })
            }
            className="h-auto p-0 text-[11px]"
          >
            الرجوع للمجلد الافتراضي
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- القائمة ---------- */

function BackupList({
  files,
  onRestore,
}: {
  files: BackupFile[];
  onRestore: (file: BackupFile) => void;
}) {
  return (
    <ul className="divide-y border text-xs">
      {files.slice(0, BACKUP_LIST_LIMIT).map((b, i) => (
        <MotionLi
          key={b.name}
          {...listItem(i)}
          className="flex items-center justify-between gap-3 px-3 py-2"
        >
          <div className="min-w-0">
            <p className="font-medium">{formatWhen(b.createdAt)}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {b.name.includes("before-restore")
                ? "نسخة أمان قبل استعادة"
                : formatFileSize(b.size)}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onRestore(b)}
            className="shrink-0 gap-1.5 font-normal"
          >
            <IconRestore className="size-3.5" />
            استعادة
          </Button>
        </MotionLi>
      ))}
    </ul>
  );
}

function HowItWorks() {
  return (
    <details className="group border bg-muted/30 px-3 py-2 text-xs">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium">
        <IconHistory className="size-4" />
        كيف أستخدم النسخ الاحتياطي؟
      </summary>
      <ol className="mt-2 list-decimal space-y-1 ps-5 text-muted-foreground">
        <li>
          البرنامج ينسخ بياناتك تلقائياً كل يوم. اضغط «نسخة احتياطية الآن» قبل
          أي تعديل كبير (استيراد Excel مثلاً).
        </li>
        <li>
          اختر «مكان حفظ النسخ» على قرص آخر أو فلاشة، حتى تبقى النسخ لو تعطّل
          قرص الجهاز.
        </li>
        <li>
          حصل خطأ أو حُذفت بيانات؟ اضغط «استعادة» بجانب نسخة بتاريخ قبل المشكلة.
          البرنامج يأخذ نسخة من الوضع الحالي أولاً، فتقدر ترجع لها لو غيّرت
          رأيك.
        </li>
        <li>
          النسخة على فلاشة أو مجلد آخر؟ استخدم «استعادة من ملف» واختر الملف.
        </li>
      </ol>
    </details>
  );
}

export function BackupSection() {
  const status = useBackupStatus();
  const backups = useBackups();
  const create = useCreateBackup();
  const files = backups.data ?? [];
  const location = status.data?.location ?? null;
  const [restoring, setRestoring] = useState<RestoreSource | null>(null);

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

      {location && <LocationEditor location={location} />}

      <div className="flex items-center justify-between gap-2 border-t pt-3">
        <span className="text-xs font-medium">النسخ المحفوظة</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setRestoring({ kind: "file" })}
          className="gap-1.5 font-normal"
        >
          <IconFolderOpen className="size-3.5" />
          استعادة من ملف…
        </Button>
      </div>
      {files.length > 0 ? (
        <BackupList
          files={files}
          onRestore={(file) => setRestoring({ kind: "listed", file })}
        />
      ) : (
        <p className="border border-dashed py-4 text-center text-xs text-muted-foreground">
          لا توجد نسخ في هذا المجلد بعد.
        </p>
      )}

      <HowItWorks />

      <RestoreDialog
        source={restoring}
        startPath={location?.path}
        onClose={() => setRestoring(null)}
      />
    </div>
  );
}
