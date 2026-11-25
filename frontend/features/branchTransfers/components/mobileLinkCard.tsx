"use client";

import {
  IconCheck,
  IconCopy,
  IconDeviceMobile,
  IconLoader2,
  IconRefresh,
} from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useNow } from "@/hooks/useNow";
import { formatDateTime } from "@/lib/dates";

import type { MobileCode } from "../api/branchTransfers.api";
import { useCreateMobileCode } from "../hooks/useBranchTransfers";

function remaining(expiresAt: string, now: number): string | null {
  const ms = Date.parse(expiresAt) - now;
  if (ms <= 0) return null;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function CodeDialog({
  code,
  onClose,
  onRenew,
  renewing,
}: {
  code: MobileCode | null;
  onClose: () => void;
  onRenew: () => void;
  renewing: boolean;
}) {
  const now = useNow(1000);
  const { copied, copy } = useCopyToClipboard();
  // قبل أول تحديث للوقت (now = null) نعتبر الكود سارياً حتى لا تومض رسالة الانتهاء.
  const left = code
    ? now === null
      ? "…"
      : remaining(code.expiresAt, now)
    : null;
  return (
    <Dialog open={code !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="text-start">
          <DialogTitle>كود ربط تطبيق الهاتف</DialogTitle>
          <DialogDescription>
            للمحل «{code?.shopName}». يُستخدم مرة واحدة فقط.
          </DialogDescription>
        </DialogHeader>
        {left ? (
          <button
            type="button"
            dir="ltr"
            onClick={() => {
              if (!code) return;
              void copy(code.code).then(
                (ok) => ok && toast.success("نُسخ الكود"),
              );
            }}
            className="flex items-center justify-center gap-2 border-2 border-dashed border-primary/50 bg-primary/5 py-4 font-mono text-2xl font-bold tracking-widest text-primary"
          >
            {code?.code}
            {copied ? (
              <IconCheck className="size-5" />
            ) : (
              <IconCopy className="size-5" />
            )}
          </button>
        ) : (
          <p className="border border-dashed p-4 text-center text-sm text-muted-foreground">
            انتهت صلاحية الكود. أصدر كوداً جديداً.
          </p>
        )}
        {code && left && (
          <p className="text-center text-xs text-muted-foreground">
            صالح لمدة <span className="font-mono">{left}</span> (حتى{" "}
            {formatDateTime(Date.parse(code.expiresAt))})
          </p>
        )}
        <ol className="list-inside list-decimal space-y-1 text-sm">
          <li>افتح تطبيق «Dealzora سلسلة» على الهاتف.</li>
          <li>اكتب هذا الكود في خانة «كود ربط الهاتف».</li>
          <li>
            ادخل باسم المستخدم وكلمة المرور نفسيهما في البرنامج (المالك أو مدير
            فرع).
          </li>
        </ol>
        <div className="flex justify-between gap-2">
          <Button
            variant="outline"
            className="gap-1.5"
            disabled={renewing}
            onClick={onRenew}
          >
            {renewing ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : (
              <IconRefresh className="size-4" />
            )}
            كود جديد
          </Button>
          <Button onClick={onClose}>تم</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** ربط تطبيق الهاتف (للمالك ومديري الفروع): كود قصير يُكتب في التطبيق مع بيانات الدخول. */
export function MobileLinkCard() {
  const create = useCreateMobileCode();
  const [code, setCode] = useState<MobileCode | null>(null);
  const issue = () => create.mutate(undefined, { onSuccess: setCode });

  return (
    <section className="flex flex-wrap items-center gap-3 border p-3">
      <span className="flex size-9 shrink-0 items-center justify-center bg-primary/10 text-primary">
        <IconDeviceMobile className="size-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium">تطبيق الهاتف</p>
        <p className="text-xs text-muted-foreground">
          تابع المبيعات والتنبيهات ووافق على التحويلات من هاتفك. أصدر كوداً
          واكتبه في التطبيق عند أول دخول.
        </p>
      </div>
      <Button
        variant="outline"
        className="gap-1.5"
        disabled={create.isPending}
        onClick={issue}
      >
        {create.isPending ? (
          <IconLoader2 className="size-4 animate-spin" />
        ) : (
          <IconDeviceMobile className="size-4" />
        )}
        كود ربط هاتف
      </Button>
      <CodeDialog
        code={code}
        onClose={() => setCode(null)}
        onRenew={issue}
        renewing={create.isPending}
      />
    </section>
  );
}
