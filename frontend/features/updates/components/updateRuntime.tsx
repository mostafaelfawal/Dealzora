"use client";

import {
  IconAlertTriangle,
  IconDownload,
  IconLoader2,
  IconRefresh,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ProgressBar } from "@/components/shared/motion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  checkForUpdate,
  formatBytes,
  installUpdate,
  updatesSupported,
  useUpdateState,
  type UpdateState,
} from "@/lib/updater";

/** أول فحص بعد فتح البرنامج (لا نزاحم تحميل الشاشة الأولى)، ثم كل 6 ساعات. */
const FIRST_CHECK_MS = 15_000;
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const TOAST_ID = "app-update";

/**
 * يفحص التحديثات في الخلفية، ولما يلاقي نسخة جديدة يعرض تنبيهاً صغيراً لا يقاطع البيع.
 * التثبيت لا يبدأ أبداً بدون ضغطة من المستخدم (البرنامج يُغلق لثوانٍ أثناءه).
 */
export function UpdateRuntime() {
  const state = useUpdateState();
  const [open, setOpen] = useState(false);
  const announced = useRef<string | null>(null);

  useEffect(() => {
    if (!updatesSupported()) return;
    const first = setTimeout(
      () => void checkForUpdate({ silent: true }),
      FIRST_CHECK_MS,
    );
    const every = setInterval(
      () => void checkForUpdate({ silent: true }),
      CHECK_EVERY_MS,
    );
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, []);

  // تنبيه مرة واحدة لكل نسخة جديدة.
  useEffect(() => {
    if (state.status !== "available") return;
    if (announced.current === state.update.version) return;
    announced.current = state.update.version;
    toast.info(`تحديث جديد متاح: الإصدار ${state.update.version}`, {
      id: TOAST_ID,
      description: "تحسينات وإصلاحات جديدة للبرنامج. التحديث يستغرق دقيقة.",
      duration: Infinity,
      action: { label: "عرض التحديث", onClick: () => setOpen(true) },
      cancel: { label: "لاحقاً", onClick: () => undefined },
    });
  }, [state]);

  // أي مكان آخر (قسم الإعدادات) يقدر يفتح نفس النافذة.
  useEffect(() => {
    const show = () => {
      toast.dismiss(TOAST_ID);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, []);

  return (
    <>
      <UpdateDialog state={state} open={open} onOpenChange={setOpen} />
      {!open && (
        <UpdateProgressCard state={state} onOpen={() => setOpen(true)} />
      )}
    </>
  );
}

/**
 * بطاقة صغيرة في زاوية الشاشة أثناء التنزيل/التثبيت: المستخدم يكمل البيع والتحديث
 * يعمل في الخلفية. الضغط عليها يفتح نافذة التحديث بالتفاصيل.
 */
function UpdateProgressCard({
  state,
  onOpen,
}: {
  state: UpdateState;
  onOpen: () => void;
}) {
  if (
    state.status !== "downloading" &&
    state.status !== "installing" &&
    !(state.status === "error" && state.update)
  )
    return null;

  const failed = state.status === "error";
  const ratio =
    state.status === "downloading"
      ? state.total
        ? state.downloaded / state.total
        : 0.05
      : 1;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-live="polite"
      className="fixed bottom-4 left-4 z-50 w-64 space-y-2 border bg-background/95 p-3 text-start shadow-lg backdrop-blur transition-colors hover:bg-muted/60"
    >
      <p className="flex items-center gap-2 text-xs font-semibold">
        {failed ? (
          <IconAlertTriangle className="size-4 shrink-0 text-destructive" />
        ) : (
          <IconLoader2 className="size-4 shrink-0 animate-spin text-primary" />
        )}
        <span className="truncate">
          {failed
            ? "تعذّر التحديث، اضغط للمحاولة مرة أخرى"
            : state.status === "installing"
              ? "جارٍ التثبيت… سيُعاد فتح البرنامج"
              : `جارٍ تنزيل الإصدار ${state.update.version}`}
        </span>
      </p>
      {!failed && <ProgressBar value={ratio} className="h-1.5" />}
      {state.status === "downloading" && (
        <p
          dir="ltr"
          className="text-end font-mono text-[11px] text-muted-foreground tabular-nums"
        >
          {formatBytes(state.downloaded)}
          {state.total ? ` / ${formatBytes(state.total)}` : ""}
          {state.total ? ` · ${Math.round(ratio * 100)}%` : ""}
        </p>
      )}
    </button>
  );
}

const OPEN_EVENT = "dealzora:open-update";
export const openUpdateDialog = () =>
  window.dispatchEvent(new Event(OPEN_EVENT));

function UpdateDialog({
  state,
  open,
  onOpenChange,
}: {
  state: UpdateState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const busy = state.status === "downloading" || state.status === "installing";
  const update =
    state.status === "available" ||
    state.status === "downloading" ||
    state.status === "installing"
      ? state.update
      : state.status === "error"
        ? state.update
        : undefined;

  if (!update) return null;

  return (
    // إغلاق النافذة لا يوقف التحديث: التقدم يظهر في بطاقة صغيرة بزاوية الشاشة.
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <IconRefresh className="size-5 text-primary" />
            الإصدار {update.version} متاح
          </DialogTitle>
          <DialogDescription>
            أنت تستخدم الإصدار {update.currentVersion}. بياناتك وإعداداتك تبقى
            كما هي.
          </DialogDescription>
        </DialogHeader>

        {update.notes && (
          <div className="max-h-48 overflow-y-auto border bg-muted/30 p-3">
            <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">
              الجديد في هذا الإصدار
            </p>
            <p className="text-xs leading-relaxed whitespace-pre-line">
              {update.notes}
            </p>
          </div>
        )}

        {state.status === "downloading" && (
          <div className="space-y-1.5" aria-live="polite">
            <ProgressBar
              value={state.total ? state.downloaded / state.total : 0.05}
              className="h-1.5"
            />
            <p className="flex justify-between text-[11px] text-muted-foreground">
              <span>جارٍ تنزيل التحديث… يمكنك متابعة العمل</span>
              <span dir="ltr" className="font-mono tabular-nums">
                {formatBytes(state.downloaded)}
                {state.total ? ` / ${formatBytes(state.total)}` : ""}
              </span>
            </p>
          </div>
        )}

        {state.status === "installing" && (
          <p
            className="flex items-center gap-2 text-xs font-medium text-primary"
            aria-live="polite"
          >
            <IconLoader2 className="size-4 animate-spin" />
            جارٍ التثبيت… سيُغلق البرنامج ويُفتح من جديد تلقائياً.
          </p>
        )}

        {state.status === "error" && (
          <p className="text-xs text-destructive" role="alert">
            {state.message}
          </p>
        )}

        {!busy && (
          <p className="text-[11px] text-muted-foreground">
            قبل التحديث: أنهِ الفاتورة المفتوحة. البرنامج سيُغلق لثوانٍ أثناء
            التثبيت.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {busy ? "إخفاء" : "لاحقاً"}
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              // نغلق النافذة فوراً ليكمل المستخدم عمله، والتقدم يظهر في الزاوية.
              onOpenChange(false);
              void installUpdate();
            }}
            className="gap-2"
          >
            {busy ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : (
              <IconDownload className="size-4" />
            )}
            {state.status === "error" ? "حاول مرة أخرى" : "تحديث الآن"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
