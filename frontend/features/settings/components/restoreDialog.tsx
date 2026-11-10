"use client";

import {
  IconAlertTriangle,
  IconCircleCheck,
  IconFolderOpen,
  IconLoader2,
  IconRestore,
} from "@tabler/icons-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AUTH_ROUTES } from "@/features/auth/config/authRoutes";
import { clearSession } from "@/features/auth/lib/authStorage";
import { formatWhen } from "@/lib/dates";

import type { BackupFile } from "../api/settings.api";
import { useRestoreBackup } from "../hooks/useSettings";
import { canPickPath, pickBackupFile } from "../lib/pickPath";

export type RestoreSource =
  { kind: "listed"; file: BackupFile } | { kind: "file" };

/** تأكيد الاستعادة بخطوات واضحة، ثم إعادة الدخول (البيانات كلها تغيّرت). */
export function RestoreDialog({
  source,
  startPath,
  onClose,
}: {
  source: RestoreSource | null;
  startPath?: string;
  onClose: () => void;
}) {
  const [done, setDone] = useState<string | null>(null);

  return (
    <Dialog
      open={source !== null}
      // بعد نجاح الاستعادة لا نسمح بالرجوع للشاشة القديمة (بياناتها لم تعد صحيحة).
      onOpenChange={(next) => !next && !done && onClose()}
    >
      <DialogContent showCloseButton={false} className="gap-3 sm:max-w-md">
        {source &&
          (done ? (
            <RestoreDone safety={done} />
          ) : (
            <RestoreForm
              source={source}
              startPath={startPath}
              onDone={setDone}
              onClose={onClose}
            />
          ))}
      </DialogContent>
    </Dialog>
  );
}

function RestoreForm({
  source,
  startPath,
  onDone,
  onClose,
}: {
  source: RestoreSource;
  startPath?: string;
  onDone: (safety: string) => void;
  onClose: () => void;
}) {
  const restore = useRestoreBackup();
  const [path, setPath] = useState("");
  const picker = canPickPath();
  const fromFile = source.kind === "file";
  const ready = !fromFile || path.trim().length > 0;

  async function browse() {
    const picked = await pickBackupFile(startPath);
    if (picked) setPath(picked);
  }

  function confirm() {
    if (!ready || restore.isPending) return;
    restore.mutate(
      source.kind === "listed"
        ? { name: source.file.name }
        : { path: path.trim() },
      { onSuccess: onDone },
    );
  }

  return (
    <>
      <DialogHeader className="text-start">
        <DialogTitle className="flex items-center gap-2">
          <IconRestore className="size-5" />
          استعادة نسخة احتياطية
        </DialogTitle>
        <DialogDescription>
          {source.kind === "listed"
            ? `النسخة المأخوذة ${formatWhen(source.file.createdAt)}`
            : "اختر ملف النسخة (من فلاشة أو مجلد آخر)"}
        </DialogDescription>
      </DialogHeader>

      {fromFile && (
        <div className="flex gap-2">
          <Input
            dir="ltr"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="E:\backups\dealzora-20261110-090000.db"
            readOnly={picker}
            onClick={picker ? browse : undefined}
            aria-label="مسار ملف النسخة"
            className="h-10 flex-1 font-mono text-xs"
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
              اختيار…
            </Button>
          )}
        </div>
      )}

      <ul className="space-y-2 border bg-muted/30 p-3 text-xs">
        <li className="flex gap-2">
          <IconAlertTriangle className="size-4 shrink-0 text-warning" />
          <span>
            <b>كل البيانات الحالية</b> (فواتير، أصناف، مخزون…) ستُستبدل ببيانات
            هذه النسخة. ما سُجّل بعد تاريخها سيختفي.
          </span>
        </li>
        <li className="flex gap-2">
          <IconCircleCheck className="size-4 shrink-0 text-primary" />
          <span>
            قبل الاستعادة نأخذ نسخة أمان من الوضع الحالي تلقائياً، فتقدر ترجع
            لها من نفس القائمة لو غيّرت رأيك.
          </span>
        </li>
        <li className="flex gap-2">
          <IconCircleCheck className="size-4 shrink-0 text-primary" />
          <span>بعد الاستعادة ستسجّل الدخول من جديد.</span>
        </li>
      </ul>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={restore.isPending}
          onClick={onClose}
          className="font-normal"
        >
          إلغاء
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="lg"
          disabled={!ready || restore.isPending}
          onClick={confirm}
          className="gap-2"
        >
          {restore.isPending ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconRestore className="size-4" />
          )}
          {restore.isPending ? "جارٍ الاستعادة…" : "استعادة الآن"}
        </Button>
      </div>
    </>
  );
}

function RestoreDone({ safety }: { safety: string }) {
  function relogin() {
    clearSession();
    // تحميل كامل: يمسح كل البيانات المؤقتة في الذاكرة (الكاشير، القوائم…).
    window.location.replace(AUTH_ROUTES.login);
  }

  return (
    <div className="space-y-3 text-center">
      <IconCircleCheck className="mx-auto size-10 text-primary" />
      <DialogTitle>تمت الاستعادة بنجاح</DialogTitle>
      <DialogDescription>
        سجّل الدخول من جديد لتبدأ العمل على البيانات المستعادة.
      </DialogDescription>
      <p className="text-[11px] text-muted-foreground">
        نسخة الوضع السابق محفوظة باسم{" "}
        <bdi dir="ltr" className="font-mono">
          {safety}
        </bdi>
      </p>
      <Button size="lg" onClick={relogin} className="w-full" autoFocus>
        تسجيل الدخول
      </Button>
    </div>
  );
}
