"use client";

import {
  IconAlertTriangle,
  IconCheck,
  IconCopy,
  IconFileCertificate,
  IconRefresh,
} from "@tabler/icons-react";
import Link from "next/link";
import { toast } from "sonner";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { Money } from "@/components/shared/Money";
import { Num } from "@/components/shared/Num";
import { Button } from "@/components/ui/button";
import type { Sale } from "@/features/sales/types/sale";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { toPounds } from "@/lib/apiMap";
import type { DateRange } from "@/lib/dates";
import { useFeature } from "@/lib/plan";
import { cn } from "@/lib/utils";

import { RECEIPT_STATUS, RESEND_LABEL } from "../config/receiptStatus";
import {
  useEReceiptReport,
  useReceiptQueue,
  useResendReceipts,
} from "../hooks/useEta";
import { StatusChip } from "./statusChip";

const SCREEN = "/admin/e-receipts";

/* ---------- مؤشر الكاشير ---------- */

/** شارة صغيرة في شريط الكاشير بعدد ما لم يصل للمنظومة بعد (لا شيء لغير سلسلة أو والميزة متوقفة). */
export function PosEReceiptBadge({ manager }: { manager: boolean }) {
  const allowed = useFeature("e_receipt");
  const { data } = useReceiptQueue();
  if (!allowed || !data?.enabled || (data.waiting === 0 && data.rejected === 0))
    return null;
  const warn = data.rejected > 0 || data.late > 0;
  const text = `إيصالات لم تصل للمنظومة: ${data.waiting}${data.rejected ? ` · مرفوضة: ${data.rejected}` : ""}${data.late ? ` · قاربت المهلة: ${data.late}` : ""}`;
  const chip = (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-1 border px-2 text-xs",
        warn ? "border-warning/50 text-warning" : "text-muted-foreground",
      )}
      aria-label={text}
    >
      <IconFileCertificate className="size-4" />
      <Num>{data.waiting}</Num>
    </span>
  );
  return (
    <AppTooltip message={text}>
      {manager ? <Link href={SCREEN}>{chip}</Link> : chip}
    </AppTooltip>
  );
}

/* ---------- تنبيه الداشبورد ---------- */

export function DashboardEReceiptAlert() {
  const allowed = useFeature("e_receipt");
  const { data } = useReceiptQueue();
  if (
    !allowed ||
    !data?.enabled ||
    (!data.rejected && !data.late && !data.overdue)
  )
    return null;
  const parts = [
    data.rejected > 0 && `${data.rejected} إيصال مرفوض أو به خطأ تحقق`,
    data.overdue > 0 && `${data.overdue} تجاوز مهلة الإرسال (24 ساعة)`,
    data.late > data.overdue && `${data.late - data.overdue} يقترب من المهلة`,
  ].filter(Boolean);
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 border border-warning/40 bg-warning/5 px-3 py-2.5 text-sm"
    >
      <IconAlertTriangle className="size-5 shrink-0 text-warning" />
      <p className="min-w-0 flex-1">
        <b>الإيصال الإلكتروني:</b> {parts.join(" · ")}.
      </p>
      <Button
        size="sm"
        variant="outline"
        nativeButton={false}
        render={<Link href={SCREEN} />}
      >
        متابعة الإيصالات
      </Button>
    </div>
  );
}

/* ---------- تفاصيل الفاتورة ---------- */

const RESENDABLE = {
  rejected: "correct",
  invalid: "regenerate",
  not_sent: "send",
} as const;

/** حالة المنظومة والـ UUID في تفاصيل الفاتورة (لا شيء لفاتورة قبل تفعيل المنظومة). */
export function SaleEReceiptInfo({ sale }: { sale: Sale }) {
  const allowed = useFeature("e_receipt");
  const resend = useResendReceipts();
  const { copied, copy: copyText } = useCopyToClipboard();
  if (!allowed || !sale.etaStatus) return null;
  const mode = RESENDABLE[sale.etaStatus as keyof typeof RESENDABLE];
  const copy = (text: string) =>
    copyText(text).then((ok) =>
      ok ? toast.success("تم نسخ الـ UUID") : toast.error("تعذّر النسخ"),
    );
  return (
    <section
      className="space-y-2 border p-3 text-xs"
      aria-label="الإيصال الإلكتروني"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-medium">
          <IconFileCertificate className="size-4" /> الإيصال الإلكتروني
        </span>
        <StatusChip status={sale.etaStatus} />
      </div>
      {sale.etaUuid && (
        <div className="flex items-start gap-1">
          <p
            className="min-w-0 flex-1 font-mono text-[10px] break-all"
            dir="ltr"
          >
            {sale.etaUuid}
          </p>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label="نسخ الـ UUID"
            onClick={() => void copy(sale.etaUuid!)}
          >
            {copied ? <IconCheck /> : <IconCopy />}
          </Button>
        </div>
      )}
      {sale.etaError && (
        <p className="text-muted-foreground" dir="auto">
          {RECEIPT_STATUS[sale.etaStatus].label}: {sale.etaError}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {mode && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1 font-normal"
            disabled={resend.isPending}
            onClick={() =>
              resend.mutate({ items: [{ kind: "sale", id: sale.id }] })
            }
          >
            <IconRefresh className="size-4" />
            {RESEND_LABEL[mode]}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          nativeButton={false}
          render={<Link href={SCREEN} />}
          className="font-normal"
        >
          كل الإيصالات
        </Button>
      </div>
    </section>
  );
}

/* ---------- تقرير الفترة ---------- */

/** المرسل/المقبول/المرفوض والضريبة المُبلغ عنها في الفترة (لخطة سلسلة فقط). */
export function EReceiptReportPanel({ range }: { range: DateRange }) {
  const allowed = useFeature("e_receipt");
  const { data } = useEReceiptReport(range.from, range.to);
  if (!allowed || !data || data.issued === 0) return null;
  const tiles = [
    { label: "صدر", value: data.issued },
    { label: "أُرسل", value: data.sent },
    { label: "مقبول", value: data.accepted, tone: "text-success" },
    {
      label: "مرفوض",
      value: data.rejected + data.invalid,
      tone: data.rejected + data.invalid ? "text-destructive" : "",
    },
    { label: "لم يصل بعد", value: data.not_sent + data.pending },
  ];
  return (
    <section className="space-y-3 border bg-card p-4">
      <h3 className="text-sm font-semibold">الإيصال الإلكتروني في الفترة</h3>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label}>
            <dt className="text-xs text-muted-foreground">{t.label}</dt>
            <dd className={cn("text-lg font-semibold", t.tone)}>
              <Num>{t.value}</Num>
            </dd>
          </div>
        ))}
      </dl>
      <p className="flex flex-wrap items-baseline gap-1.5 text-sm">
        الضريبة المُبلغ عنها (المقبول فقط):
        <Money amount={toPounds(data.tax_reported)} className="font-semibold" />
        <span className="text-xs text-muted-foreground">
          (فواتير{" "}
          <Money amount={toPounds(data.tax_sales)} className="text-xs" /> −
          مرتجعات{" "}
          <Money amount={toPounds(data.tax_returns)} className="text-xs" />)
        </span>
      </p>
    </section>
  );
}
