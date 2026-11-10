"use client";

import { Input } from "@/components/ui/input";
import {
  PERIOD_LABELS,
  presetRange,
  type DateRange,
  type PeriodPreset,
} from "@/lib/dates";

import { OptionSelect } from "./OptionSelect";

export interface PeriodValue {
  preset: PeriodPreset;
  range: DateRange;
}

export const periodOf = (preset: PeriodPreset): PeriodValue => ({
  preset,
  range: presetRange(preset),
});

/** اختيار الفترة: فترات جاهزة + تواريخ مخصصة عند اختيار "فترة مخصصة". */
export function PeriodPicker({
  value,
  onChange,
  presets = ["today", "yesterday", "week", "month", "last_month", "year", "custom"],
}: {
  value: PeriodValue;
  onChange: (value: PeriodValue) => void;
  presets?: PeriodPreset[];
}) {
  const items = presets.map((p) => ({ value: p, label: PERIOD_LABELS[p] }));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <OptionSelect<PeriodPreset>
        label="الفترة"
        items={items}
        value={value.preset}
        onChange={(preset) =>
          onChange(
            preset === "custom"
              ? { preset, range: value.range }
              : periodOf(preset),
          )
        }
        className="w-40"
      />
      {value.preset === "custom" && (
        <>
          <Input
            type="date"
            aria-label="من تاريخ"
            dir="ltr"
            value={value.range.from}
            max={value.range.to}
            onChange={(e) =>
              e.target.value &&
              onChange({
                preset: "custom",
                range: { ...value.range, from: e.target.value },
              })
            }
            className="h-10 w-40 font-mono"
          />
          <span className="text-xs text-muted-foreground">إلى</span>
          <Input
            type="date"
            aria-label="إلى تاريخ"
            dir="ltr"
            value={value.range.to}
            min={value.range.from}
            onChange={(e) =>
              e.target.value &&
              onChange({
                preset: "custom",
                range: { ...value.range, to: e.target.value },
              })
            }
            className="h-10 w-40 font-mono"
          />
        </>
      )}
    </div>
  );
}
