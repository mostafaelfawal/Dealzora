"use client";

import { CURRENCY_LABEL } from "@/lib/format";

import { formatFull } from "./chartTheme";

export interface TooltipRow {
  label: string;
  value: number;
  color: string;
  /** "money" (افتراضي) أو "count" أو "qty". */
  kind?: "money" | "count" | "qty";
  dashed?: boolean;
}

/** محتوى تلميح موحّد: عنوان + صفوف (علامة لون + اسم + قيمة). النص بألوان النص وليس لون السلسلة. */
export function ChartTooltipBox({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="min-w-40 border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-medium">{title}</p>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                aria-hidden
                className="inline-block h-0.5 w-3"
                style={{
                  background: r.dashed ? "transparent" : r.color,
                  borderTop: r.dashed ? `2px dashed ${r.color}` : undefined,
                  height: r.dashed ? 0 : 8,
                  width: r.dashed ? 12 : 8,
                  borderRadius: 2,
                }}
              />
              {r.label}
            </span>
            <span dir="ltr" className="font-mono font-semibold tabular-nums">
              {formatFull(r.value)}
              {(r.kind ?? "money") === "money" && (
                <span className="ms-1 text-[10px] font-normal text-muted-foreground">{CURRENCY_LABEL}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** وسيلة إيضاح صغيرة فوق الرسم (تظهر مع سلسلتين أو أكثر). */
export function ChartLegend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block"
            style={
              i.dashed
                ? { width: 14, borderTop: `2px dashed ${i.color}` }
                : { width: 10, height: 10, background: i.color, borderRadius: 2 }
            }
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
