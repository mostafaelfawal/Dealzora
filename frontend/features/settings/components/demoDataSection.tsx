"use client";

import {
  IconDatabasePlus,
  IconFlask,
  IconLoader2,
  IconTrash,
} from "@tabler/icons-react";
import { useState } from "react";

import { Num } from "@/components/shared/Num";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { DemoStatus } from "../api/devtools.api";
import { IS_DEV, useDemoMutations, useDemoStatus } from "../hooks/useDemoData";

type DemoAction = "seed" | "clear";

const DEMO_CASHIER = "demo.cashier1";
const count = (n: number) => n.toLocaleString("en-US");

const CONFIRM_COPY: Record<
  DemoAction,
  { title: string; action: string; body: (s: DemoStatus) => string }
> = {
  seed: {
    title: "إنشاء بيانات تجريبية؟",
    action: "إنشاء",
    body: () =>
      "سيُنشأ أكثر من 600 فاتورة و10 آلاف سجل تقريباً. يلزم ألا تكون هناك وردية مفتوحة. ستبقى وردية تجريبية مفتوحة لليوم.",
  },
  clear: {
    title: "حذف كل البيانات التجريبية؟",
    action: "حذف",
    body: (s) =>
      `سيُحذف ${count(s.records)} سجل أنشأها المولّد فقط. لو بِعت صنفاً تجريبياً أو تعاملت مع عميل تجريبي بنفسك، سيُرفض الحذف كاملاً لحماية بياناتك.`,
  },
};

function DemoHeader() {
  return (
    <header className="flex items-start gap-3">
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center bg-warning/15 text-warning [&_svg]:size-4"
      >
        <IconFlask />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          بيانات تجريبية
          <Badge
            variant="outline"
            className="border-warning/60 font-normal text-warning"
          >
            للتطوير فقط
          </Badge>
        </h2>
        <p className="text-xs text-muted-foreground">
          ينشئ محلاً كاملاً لآخر 60 يوماً عبر خدمات النظام نفسها: أصناف وأقسام،
          عملاء آجل، موردون، فواتير بيع وشراء، مرتجعات، ورديات، مصروفات، تحصيل
          وسداد. كل سجل يُحفظ رقمه، فالحذف يزيلها كلها دفعة واحدة دون لمس
          بياناتك الحقيقية.
        </p>
      </div>
    </header>
  );
}

function DemoState({ status: s }: { status: DemoStatus }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {s.loaded ? (
        <>
          <Badge className="font-normal">محمّلة · {count(s.records)} سجل</Badge>
          <span className="text-muted-foreground">
            دخول الكاشير التجريبي: <Num>{DEMO_CASHIER}</Num> /{" "}
            <Num className="select-all">{s.demo_password}</Num>
          </span>
        </>
      ) : (
        <span className="text-muted-foreground">
          لا توجد بيانات تجريبية الآن.
        </span>
      )}
    </div>
  );
}

function ConfirmDemoDialog({
  action,
  status,
  busy,
  onCancel,
  onConfirm,
}: {
  action: DemoAction | null;
  status: DemoStatus;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const copy = action ? CONFIRM_COPY[action] : null;
  return (
    <Dialog
      open={action !== null}
      onOpenChange={(next) => !next && !busy && onCancel()}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <DialogHeader className="text-start">
          <DialogTitle>{copy?.title}</DialogTitle>
          <DialogDescription>{copy?.body(status)}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            size="lg"
            disabled={busy}
            onClick={onCancel}
          >
            رجوع
          </Button>
          <Button
            size="lg"
            variant={action === "clear" ? "destructive" : "default"}
            disabled={busy}
            onClick={onConfirm}
            className="gap-2"
          >
            {busy && <IconLoader2 className="size-4 animate-spin" />}
            {copy?.action}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * أدوات التطوير فقط: يظهر في `next dev` وعندما يكون الـ backend بـ POS_DEBUG=true.
 * في الإنتاج لا يُعرض القسم، ومسارات /dev غير موجودة أصلاً في الـ backend.
 */
export function DemoDataSection() {
  const [confirm, setConfirm] = useState<DemoAction | null>(null);
  const status = useDemoStatus();
  const { seed, clear, busy } = useDemoMutations({
    onSettled: () => setConfirm(null),
  });

  // خارج التطوير، أو الـ backend ليس في وضع debug (404) → لا شيء.
  if (!IS_DEV || !status.data?.enabled) return null;
  const s = status.data;

  return (
    <section className="space-y-3 border border-dashed border-warning/60 bg-warning/5 p-4">
      <DemoHeader />
      <DemoState status={s} />

      <div className="flex flex-wrap gap-2">
        <Button
          size="lg"
          disabled={busy || s.loaded}
          onClick={() => setConfirm("seed")}
          className="gap-2"
        >
          {seed.isPending ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconDatabasePlus className="size-4" />
          )}
          {seed.isPending
            ? "جارٍ الإنشاء… (حتى دقيقة)"
            : "إنشاء بيانات تجريبية"}
        </Button>
        <Button
          size="lg"
          variant="destructive"
          disabled={busy || !s.loaded}
          onClick={() => setConfirm("clear")}
          className="gap-2"
        >
          {clear.isPending ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconTrash className="size-4" />
          )}
          حذف البيانات التجريبية
        </Button>
      </div>

      <ConfirmDemoDialog
        action={confirm}
        status={s}
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => (confirm === "seed" ? seed.mutate() : clear.mutate())}
      />
    </section>
  );
}
