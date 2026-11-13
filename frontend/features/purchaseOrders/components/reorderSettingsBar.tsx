"use client";

import { OptionSelect } from "@/components/shared/OptionSelect";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import {
  COVER_DAYS_OPTIONS,
  LEAD_DAYS_OPTIONS,
  SALES_DAYS_OPTIONS,
} from "../config/purchaseOrderOptions";
import type { ReorderSettings } from "../types/purchaseOrder";

const days = (n: number) =>
  n === 0 ? "نفس اليوم" : n === 1 ? "يوم" : n === 2 ? "يومان" : `${n} يوم`;

const opts = (values: readonly number[], fmt = days) =>
  values.map((v) => ({ value: String(v), label: fmt(v) }));

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
      <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

/** كيف نحسب الحاجة: فترة معدل البيع، كم يكفي الطلب، كم يأخذ المورد. */
export function ReorderSettingsBar({
  settings,
  onChange,
}: {
  settings: ReorderSettings;
  onChange: (patch: Partial<ReorderSettings>) => void;
}) {
  return (
    <section className="grid grid-cols-2 gap-3 border bg-card p-3 lg:grid-cols-4">
      <Field label="معدل البيع من آخر" hint="المبيعات الفعلية في هذه الفترة">
        <OptionSelect
          label="فترة معدل البيع"
          items={opts(SALES_DAYS_OPTIONS)}
          value={String(settings.salesDays)}
          onChange={(v) => onChange({ salesDays: Number(v) })}
          className="w-full"
        />
      </Field>
      <Field label="الطلب يكفي" hint="بعد وصول البضاعة">
        <OptionSelect
          label="مدة التغطية"
          items={opts(COVER_DAYS_OPTIONS)}
          value={String(settings.coverDays)}
          onChange={(v) => onChange({ coverDays: Number(v) })}
          className="w-full"
        />
      </Field>
      <Field label="المورد يورّد خلال" hint="من الطلب حتى الاستلام">
        <OptionSelect
          label="مدة التوريد"
          items={opts(LEAD_DAYS_OPTIONS)}
          value={String(settings.leadDays)}
          onChange={(v) => onChange({ leadDays: Number(v) })}
          className="w-full"
        />
      </Field>
      <Field
        label="تقريب للكرتونة"
        hint="إذا كان للصنف وحدة أكبر (كرتونة/دستة)"
      >
        <label className="flex h-10 items-center gap-2 border px-3 text-sm">
          <Switch
            checked={settings.roundPacks}
            onCheckedChange={(v) => onChange({ roundPacks: v })}
          />
          {settings.roundPacks ? "مفعّل" : "متوقف"}
        </label>
      </Field>
    </section>
  );
}
