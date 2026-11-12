"use client";

import {
  IconAlertTriangle,
  IconCalendarTime,
  IconCircleCheck,
  IconClockExclamation,
  IconPackages,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Money } from "@/components/shared/Money";
import { Num } from "@/components/shared/Num";
import { OptionSelect } from "@/components/shared/OptionSelect";
import { PageHeader } from "@/components/shared/PageHeader";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { StatTile } from "@/components/shared/StatTile";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, parseIsoDay } from "@/lib/dates";
import { extractErrorMessage } from "@/lib/errors";
import { formatMoneyText, formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  fetchExpiryList,
  fetchExpirySummary,
  writeOffBatch,
  type Batch,
  type ExpiryStatus,
} from "../api/expiry.api";

const STATUS_TABS: { id: ExpiryStatus; label: string }[] = [
  { id: "soon", label: "قربت تنتهي" },
  { id: "expired", label: "منتهية" },
  { id: "valid", label: "كل الصالح" },
  { id: "all", label: "الكل" },
];

const DAYS = [7, 14, 30, 60, 90].map((d) => ({
  value: String(d),
  label: `خلال ${d} يوم`,
}));

/** «منتهي من 3 أيام» / «باقي 5 أيام» / «بدون تاريخ». */
function daysText(b: Batch): { text: string; className: string } {
  if (b.daysLeft === null)
    return { text: "بدون تاريخ", className: "text-muted-foreground" };
  if (b.daysLeft < 0)
    return {
      text: `منتهي من ${-b.daysLeft} يوم`,
      className: "bg-destructive/10 text-destructive",
    };
  if (b.daysLeft === 0)
    return {
      text: "ينتهي اليوم",
      className: "bg-destructive/10 text-destructive",
    };
  if (b.daysLeft <= 7)
    return {
      text: `باقي ${b.daysLeft} يوم`,
      className: "bg-warning/15 text-warning",
    };
  if (b.daysLeft <= 30)
    return {
      text: `باقي ${b.daysLeft} يوم`,
      className: "bg-primary/10 text-primary",
    };
  return { text: `باقي ${b.daysLeft} يوم`, className: "text-muted-foreground" };
}

function BatchRow({ b, onWriteOff }: { b: Batch; onWriteOff: () => void }) {
  const d = daysText(b);
  return (
    <tr className="border-t">
      <td className="p-2">
        <span className="block truncate font-medium">{b.productName}</span>
        <span className="text-[11px] text-muted-foreground">
          {b.batchNo ? `تشغيلة ${b.batchNo} · ` : ""}وصل{" "}
          {formatDate(parseIsoDay(b.receivedOn))}
        </span>
      </td>
      <td className="p-2 whitespace-nowrap">
        {b.expiryDate ? formatDate(parseIsoDay(b.expiryDate)) : "—"}
      </td>
      <td className="p-2">
        <span
          className={cn(
            "px-1.5 py-0.5 text-[11px] whitespace-nowrap",
            d.className,
          )}
        >
          {d.text}
        </span>
      </td>
      <td className="p-2 whitespace-nowrap">
        <Num>{formatQty(b.qtyRemaining)}</Num> {b.unit}
      </td>
      <td className="p-2 text-end">
        <Money amount={b.value} className="text-sm" />
      </td>
      <td className="p-2 text-end">
        <Button
          variant={
            b.daysLeft !== null && b.daysLeft < 0 ? "destructive" : "ghost"
          }
          size="sm"
          className="gap-1"
          onClick={onWriteOff}
        >
          <IconTrash className="size-4" />
          إعدام
        </Button>
      </td>
    </tr>
  );
}

/** الصلاحية: ما انتهى وما قرب ينتهي، بقيمته، وإعدام الدفعة بضغطة (حركة «تالف»). */
export function ExpiryScreen() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<ExpiryStatus>("soon");
  const [days, setDays] = useState(30);
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<Batch | null>(null);

  const summary = useQuery({
    queryKey: ["expiry", "summary"],
    queryFn: fetchExpirySummary,
  });
  const list = useQuery({
    queryKey: ["expiry", "list", status, days, q],
    queryFn: () => fetchExpiryList(status, days, q),
    placeholderData: keepPreviousData,
  });
  const writeOff = useMutation({
    mutationFn: (b: Batch) => writeOffBatch(b.id),
    onSuccess: (_r, b) => {
      void qc.invalidateQueries({ queryKey: ["expiry"] });
      void qc.invalidateQueries({ queryKey: ["products"] });
      void qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success(
        `تم إعدام ${formatQty(b.qtyRemaining)} ${b.unit} من «${b.productName}»`,
        {
          description: `سُجلت كتالف في حركة المخزون (${formatMoneyText(b.value)}).`,
        },
      );
      setTarget(null);
    },
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّر إعدام الدفعة")),
  });

  const s = summary.data;
  const items = list.data ?? [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <PageHeader
        title="الصلاحية"
        description="تابع الأصناف اللي قربت صلاحيتها عشان تبيعها أو تعمل عليها عرض قبل ما تنتهي، واعدم المنتهي. البيع بيسحب الأقرب انتهاءً تلقائياً والمنتهي ما يتباعش."
      />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatTile
          index={0}
          icon={<IconAlertTriangle />}
          label="دفعات منتهية"
          tone="danger"
          hint={s ? `قيمتها ${formatMoneyText(s.expiredValue)}` : undefined}
          onClick={() => setStatus("expired")}
          active={status === "expired"}
        >
          {s?.expiredBatches ?? 0}
        </StatTile>
        <StatTile
          index={1}
          icon={<IconClockExclamation />}
          label="تنتهي خلال 7 أيام"
          tone="warning"
          onClick={() => {
            setStatus("soon");
            setDays(7);
          }}
          active={status === "soon" && days === 7}
        >
          {s?.soon7 ?? 0}
        </StatTile>
        <StatTile
          index={2}
          icon={<IconCalendarTime />}
          label="تنتهي خلال 30 يوم"
          hint={s ? `قيمتها ${formatMoneyText(s.soon30Value)}` : undefined}
          onClick={() => {
            setStatus("soon");
            setDays(30);
          }}
          active={status === "soon" && days === 30}
        >
          {s?.soon30 ?? 0}
        </StatTile>
        <StatTile index={3} icon={<IconPackages />} label="أصناف متتبَّعة">
          {s?.trackedProducts ?? 0}
        </StatTile>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SegmentedTabs
          label="الحالة"
          items={STATUS_TABS}
          value={status}
          onChange={setStatus}
        />
        {status === "soon" && (
          <OptionSelect
            label="المدة"
            items={DAYS}
            value={String(days)}
            onChange={(v) => setDays(Number(v))}
            className="w-36"
          />
        )}
        <div className="relative ms-auto w-full sm:w-64">
          <IconSearch className="pointer-events-none absolute inset-s-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="اسم الصنف أو رقم التشغيلة"
            className="h-10 ps-8"
            aria-label="بحث"
          />
        </div>
      </div>

      {list.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 border bg-card p-10 text-center">
          <IconCircleCheck className="size-10 text-success" />
          <p className="font-medium">
            {status === "expired" ? "مافيش حاجة منتهية" : "مافيش دفعات هنا"}
          </p>
          {!s?.trackedProducts && (
            <p className="max-w-md text-sm text-muted-foreground">
              فعّل «تتبع الصلاحية والدفعات» من شاشة الصنف، وسجّل تاريخ الصلاحية في
              فاتورة الشراء.
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto border bg-card">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="p-2 text-start font-normal">الصنف</th>
                <th className="p-2 text-start font-normal">الصلاحية</th>
                <th className="p-2 text-start font-normal">الحالة</th>
                <th className="p-2 text-start font-normal">المتبقي</th>
                <th className="p-2 text-end font-normal">القيمة (شراء)</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <BatchRow key={b.id} b={b} onWriteOff={() => setTarget(b)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader className="text-start">
            <DialogTitle>إعدام دفعة «{target?.productName}»؟</DialogTitle>
            <DialogDescription>
              هيتخصم <Num>{formatQty(target?.qtyRemaining ?? 0)}</Num>{" "}
              {target?.unit} من المخزون كـ«تالف» (قيمتها{" "}
              {formatMoneyText(target?.value ?? 0)}). مش هينفع ترجع فيها.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTarget(null)}>
              رجوع
            </Button>
            <Button
              variant="destructive"
              disabled={writeOff.isPending}
              onClick={() => target && writeOff.mutate(target)}
            >
              إعدام
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
