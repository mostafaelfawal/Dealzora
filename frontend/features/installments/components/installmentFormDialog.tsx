"use client";

import {
  IconCheck,
  IconDeviceFloppy,
  IconFileInvoice,
  IconLoader2,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";

import { CurrencyLabel } from "@/components/shared/CurrencyLabel";
import { Money } from "@/components/shared/Money";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import useGetCustomers from "@/features/customers/hooks/useGetCustomers";
import type { Customer } from "@/features/customers/types/customer";
import { normalizeSearch } from "@/features/pos/lib/posCalc";
import { todayIso } from "@/lib/dates";
import {
  formatMoneyText,
  normalizeDigits,
  parseNumberInput,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { AppTooltip } from "@/components/shared/AppTooltip";

import { useCreatePlan, usePlans } from "../hooks/useInstallments";
import { nextMonthIso, previewPlan } from "../lib/installmentCalc";
import {
  COUNT_PRESETS,
  FREQUENCIES,
  FREQUENCY_LABEL,
  isoDate,
} from "../lib/installmentText";
import type { Frequency } from "../types/installment";
import { RibaNoticeButton } from "./ribaNoticeDialog";

interface Draft {
  customerId: string;
  title: string;
  /** null = لم يكتبه التاجر بعد: يُعرض دين العميل غير المقسّط كاملاً. */
  principal: string | null;
  downPayment: string;
  count: string;
  frequency: Frequency;
  startDate: string;
  note: string;
}

/** تعبئة مسبقة (من الكاشير بعد بيع آجل، أو من صفحة العميل). */
export interface PlanPrefill {
  customerId?: string | null;
  title?: string;
  amount?: number;
}

const num = (text: string) => parseNumberInput(normalizeDigits(text));
const money = (text: string) => {
  const n = num(text);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function MoneyInput({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        inputMode="decimal"
        autoComplete="off"
        maxLength={12}
        aria-label={label}
        placeholder={placeholder}
        className="h-10 pe-12 font-mono tabular-nums"
      />
      <span className="pointer-events-none absolute inset-e-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
        <CurrencyLabel />
      </span>
    </div>
  );
}

/** اختيار العميل: بحث بالاسم أو الهاتف، مع مديونيته ظاهرة. */
function CustomerPicker({
  customers,
  loading,
  selected,
  onSelect,
  unscheduled,
}: {
  customers: Customer[];
  loading: boolean;
  selected: Customer | null;
  onSelect: (c: Customer | null) => void;
  unscheduled: (c: Customer) => number;
}) {
  const [query, setQuery] = useState("");
  const q = normalizeSearch(query);
  const results = q
    ? customers
        .filter(
          (c) => normalizeSearch(c.name).includes(q) || c.phone.includes(q),
        )
        .slice(0, 6)
    : [];

  if (selected) {
    const free = unscheduled(selected);
    return (
      <div className="flex items-center gap-3 border border-primary/40 bg-primary/5 p-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center bg-primary text-primary-foreground">
          <IconCheck className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <AppTooltip message={selected.name} onlyWhenTruncated>
            <p className="truncate text-sm font-medium">{selected.name}</p>
          </AppTooltip>
          <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
            {selected.phone && <span dir="ltr">{selected.phone}</span>}
            <span className="flex items-baseline gap-1">
              مديونيته{" "}
              <Money
                amount={Math.max(selected.balance, 0)}
                className="text-foreground"
              />
            </span>
            {free !== Math.max(selected.balance, 0) && (
              <span className="flex items-baseline gap-1">
                غير مقسّط <Money amount={free} className="text-foreground" />
              </span>
            )}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="تغيير العميل"
          onClick={() => onSelect(null)}
        >
          <IconX className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <IconSearch className="pointer-events-none absolute inset-s-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            loading ? "جارٍ تحميل العملاء…" : "ابحث باسم العميل أو رقم هاتفه"
          }
          className="h-10 ps-8"
          aria-label="بحث عن عميل"
          autoComplete="off"
        />
      </div>
      {results.length > 0 && (
        <ul className="max-h-48 divide-y overflow-y-auto border">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(c);
                  setQuery("");
                }}
                className="flex w-full items-center gap-2 p-2 text-start text-sm hover:bg-muted"
              >
                <AppTooltip message={c.name} onlyWhenTruncated>
                  <span className="flex-1 truncate">{c.name}</span>
                </AppTooltip>
                {c.phone && (
                  <span
                    dir="ltr"
                    className="font-mono text-xs text-muted-foreground"
                  >
                    {c.phone}
                  </span>
                )}
                {c.balance > 0 && (
                  <span className="flex items-baseline gap-1 text-xs text-muted-foreground">
                    دين <Money amount={c.balance} className="text-foreground" />
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {q && results.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground">
          لا عميل بهذا الاسم. أضفه من صفحة العملاء أولاً.
        </p>
      )}
    </div>
  );
}

function PlanForm({
  prefill,
  onDone,
  onCreated,
}: {
  prefill: PlanPrefill;
  onDone: () => void;
  onCreated: () => void;
}) {
  const create = useCreatePlan();
  const customersQuery = useGetCustomers();
  const plans = usePlans().data ?? [];
  const customers = useMemo(
    () => (customersQuery.data ?? []).filter((c) => c.isActive),
    [customersQuery.data],
  );

  const [d, setD] = useState<Draft>({
    customerId: prefill.customerId ?? "",
    title: prefill.title ?? "",
    principal: prefill.amount ? String(prefill.amount) : null,
    downPayment: "",
    count: "6",
    frequency: "monthly",
    startDate: nextMonthIso(),
    note: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const patch = (p: Partial<Draft>) => setD((prev) => ({ ...prev, ...p }));

  const customer = customers.find((c) => c.id === d.customerId) ?? null;
  // المقسّط بالفعل من دين العميل = المتبقي على خططه الجارية.
  const unscheduled = (c: Customer) =>
    Math.max(
      Math.round(
        (c.balance -
          plans
            .filter((p) => p.customerId === c.id && p.status === "active")
            .reduce((s, p) => s + p.remaining, 0)) *
          100,
      ) / 100,
      0,
    );

  const principalText =
    d.principal ?? (customer ? String(unscheduled(customer)) : "");
  const principal = money(principalText);
  const down = d.downPayment.trim() ? money(d.downPayment) : 0;
  const count = num(d.count);
  const preview = previewPlan({
    principal: Number.isFinite(principal) ? principal : 0,
    downPayment: Number.isFinite(down) ? down : 0,
    count: Number.isInteger(count) && count > 0 ? count : 1,
    frequency: d.frequency,
    startDate: d.startDate,
  });

  let error: string | null = null;
  if (!customer) error = "اختر العميل";
  else if (!(principal > 0)) error = "اكتب مبلغ التقسيط";
  else if (unscheduled(customer) <= 0)
    error = "لا توجد على العميل مديونية غير مقسّطة. بِع له آجلاً من الكاشير أولاً";
  else if (principal > unscheduled(customer))
    error = `المبلغ أكبر من مديونيته غير المقسّطة (${formatMoneyText(unscheduled(customer))})`;
  else if (!Number.isFinite(down) || down < 0) error = "المقدّم غير صحيح";
  else if (down > principal) error = "المقدّم أكبر من مبلغ التقسيط";
  else if (!Number.isInteger(count) || count < 1 || count > 120)
    error = "عدد الأقساط من 1 إلى 120";
  else if (!d.startDate) error = "اختر موعد أول قسط";
  else if (preview.total <= 0) error = "لا يتبقى مبلغ للتقسيط بعد المقدّم";

  const defaultTitle = "تقسيط مديونية";

  function pickCustomer(c: Customer | null) {
    // المبلغ يُعاد لغير المقسّط من دين العميل الجديد.
    patch({ customerId: c?.id ?? "", principal: null });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (error || !customer) return;
    const title = d.title.trim() || defaultTitle;
    create.mutate(
      {
        customerId: customer.id,
        title,
        principal,
        downPayment: down,
        installmentsCount: count,
        frequency: d.frequency,
        startDate: d.startDate,
        note: d.note,
      },
      { onSuccess: onCreated },
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* 1) كيف يُباع بالتقسيط */}
      <p className="flex gap-2 border bg-muted/40 p-3 text-xs text-muted-foreground">
        <IconFileInvoice className="size-4 shrink-0 text-primary" />
        <span>
          يُقسَّط دين مسجّل على العميل. لبيع جديد بالتقسيط: بِع من الكاشير
          بالدفع الآجل (فيُخصم المخزون وتصدر الفاتورة)، ثم اضغط «قسّط هذه
          الفاتورة» بعد إتمام البيع.
        </span>
      </p>

      {/* 2) العميل والعنوان */}
      <div className="space-y-2">
        <Label>العميل</Label>
        <CustomerPicker
          customers={customers}
          loading={customersQuery.isPending}
          selected={customer}
          onSelect={pickCustomer}
          unscheduled={unscheduled}
        />
      </div>

      <Field
        label="عنوان الخطة (اختياري)"
        hint="يظهر في القائمة وفي ملاحظات كشف حساب العميل. مثال: ثلاجة 16 قدم."
      >
        <Input
          value={d.title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder={defaultTitle}
          maxLength={80}
          className="h-10"
        />
      </Field>

      {/* 3) المبالغ */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="المبلغ المقسَّط"
          hint={
            customer
              ? `الحد الأقصى: ${formatMoneyText(unscheduled(customer))}`
              : undefined
          }
        >
          <MoneyInput
            value={principalText}
            onChange={(principal) => patch({ principal })}
            label="مبلغ التقسيط"
            placeholder="0"
          />
        </Field>
        <Field label="المقدّم (اختياري)" hint="يُحصَّل الآن ويدخل الخزنة.">
          <MoneyInput
            value={d.downPayment}
            onChange={(downPayment) => patch({ downPayment })}
            label="المقدّم"
            placeholder="0"
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border border-dashed p-3">
        <p className="text-xs text-muted-foreground">
          الأقساط بلا فائدة: يدفع العميل المبلغ بعد المقدّم فقط.
        </p>
        <RibaNoticeButton />
      </div>

      {/* 4) الجدول */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>دورية الأقساط</Label>
          <SegmentedTabs
            label="دورية الأقساط"
            items={FREQUENCIES}
            value={d.frequency}
            onChange={(frequency) => patch({ frequency })}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="عدد الأقساط">
            <Input
              value={d.count}
              onChange={(e) => patch({ count: e.target.value })}
              onFocus={(e) => e.currentTarget.select()}
              inputMode="numeric"
              dir="ltr"
              className="h-10 font-mono"
              aria-label="عدد الأقساط"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {COUNT_PRESETS.map((p) => (
                <Button
                  key={p}
                  type="button"
                  size="sm"
                  variant={num(d.count) === p ? "default" : "outline"}
                  onClick={() => patch({ count: String(p) })}
                  className="font-normal"
                >
                  {p}
                </Button>
              ))}
            </div>
          </Field>
          <Field label="موعد أول قسط">
            <Input
              type="date"
              value={d.startDate}
              min={todayIso()}
              onChange={(e) => patch({ startDate: e.target.value })}
              dir="ltr"
              className="h-10 font-mono"
            />
          </Field>
        </div>
      </div>

      <Input
        value={d.note}
        onChange={(e) => patch({ note: e.target.value })}
        aria-label="ملاحظة على الخطة"
        placeholder="ملاحظة (اختياري): ضامن، رقم إيصال أمانة…"
        maxLength={200}
        className="h-10"
      />

      {/* 5) الملخص */}
      <dl
        aria-live="polite"
        className="grid grid-cols-3 gap-3 border bg-muted/40 p-4 text-xs"
      >
        <div className="space-y-1">
          <dt className="text-muted-foreground">بعد المقدّم</dt>
          <dd>
            <Money amount={preview.financed} className="text-base" />
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-muted-foreground">إجمالي الأقساط</dt>
          <dd>
            <Money amount={preview.total} className="text-base" />
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-muted-foreground">القسط</dt>
          <dd className="space-y-0.5">
            <Money
              amount={preview.installment}
              className="text-base text-primary"
            />
            <span className="block text-[11px] text-muted-foreground">
              {FREQUENCY_LABEL[d.frequency]}
              {preview.lastInstallment !== preview.installment &&
                ` · الأخير ${formatMoneyText(preview.lastInstallment)}`}
            </span>
          </dd>
        </div>
        {preview.endDate && (
          <p className="col-span-full border-t pt-2 text-muted-foreground">
            آخر قسط يوم{" "}
            <span className="text-foreground">{isoDate(preview.endDate)}</span>
          </p>
        )}
      </dl>

      {submitted && error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="lg" onClick={onDone}>
          إلغاء
        </Button>
        <Button
          type="submit"
          size="lg"
          disabled={create.isPending}
          className="gap-2"
        >
          {create.isPending ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconDeviceFloppy className="size-4" />
          )}
          إنشاء الخطة
        </Button>
      </div>
    </form>
  );
}

export function InstallmentFormDialog({
  open,
  prefill = {},
  onClose,
  onCreated,
}: {
  open: boolean;
  /** عميل/مبلغ/عنوان مختار مسبقاً (من صفحة العميل أو بعد بيع آجل في الكاشير). */
  prefill?: PlanPrefill;
  onClose: () => void;
  onCreated?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="text-start">
          <DialogTitle>خطة تقسيط جديدة</DialogTitle>
          <DialogDescription>
            قسّط مديونية العميل على أقساط شهرية أو أسبوعية بلا فائدة، ويُسجَّل
            كل قسط في كشف حسابه وفي الخزنة.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <PlanForm
            prefill={prefill}
            onDone={onClose}
            onCreated={onCreated ?? onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
