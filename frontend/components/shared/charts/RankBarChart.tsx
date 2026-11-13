"use client";

import { useState } from "react";

import { CHART, formatCompact } from "./chartTheme";
import { ChartTooltipBox, type TooltipRow } from "./ChartTooltip";

export interface RankItem {
  key: string;
  label: string;
  value: number;
  /** صفوف إضافية في التلميح (إيراد، كمية…). */
  extra?: Omit<TooltipRow, "color">[];
  /** لون حالة صريح (داخل/خارج…) بدل اللون الافتراضي. يجب أن يرافقه نص في الاسم. */
  color?: string;
}

const ROW = 30; // ارتفاع كل صف
const BAR = 14; // سُمك العمود
const MIN_BAR = 2; // أصغر طول ظاهر حتى لا تختفي القيم الصغيرة

const colorOf = (i: RankItem) =>
  i.color ?? (i.value < 0 ? CHART.bad : CHART.main);

/**
 * ترتيب أفقي بالاتجاه العربي، بـ HTML/CSS خالص:
 * الاسم على اليمين، والعمود يبدأ بجواره ويمتد لليسار بطول نسبي، والقيمة عند طرفه.
 *
 * لماذا ليس Recharts؟ لأنه يرسم من اليسار لليمين، وقلب المحور (reversed) داخل حاوية LTR
 * كان يعكس بداية العمود ونهايته (الطرف المدوّر والقيمة في الجهة الخطأ).
 * الـ flex في RTL يعطي الاتجاه الصحيح مباشرة، و rounded-e يدوّر نهاية العمود فقط.
 * القيم السالبة تُعرض بطولها المطلق وبلون الخسارة.
 */
export function RankBarChart({
  items,
  valueLabel,
  kind = "money",
  labelWidth = 128,
}: {
  items: RankItem[];
  valueLabel: string;
  kind?: TooltipRow["kind"];
  labelWidth?: number;
}) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 0) || 1;

  return (
    <ul dir="rtl" className="relative" onMouseLeave={() => setActive(null)}>
      {items.map((item, i) => {
        const pct = (Math.abs(item.value) / max) * 100;
        const isActive = active === item.key;
        return (
          <li
            key={item.key}
            tabIndex={0}
            aria-label={`${item.label}: ${item.value}`}
            onMouseEnter={() => setActive(item.key)}
            onFocus={() => setActive(item.key)}
            onBlur={() => setActive(null)}
            className="relative flex items-center gap-2 outline-none focus-visible:bg-muted/60"
            style={{
              height: ROW,
              background: isActive ? "var(--muted)" : undefined,
            }}
          >
            <span
              className="flex shrink-0 items-center gap-1.5 text-xs"
              style={{ width: labelWidth }}
            >
              <span className="w-4 shrink-0 font-mono text-[10px] text-muted-foreground">
                {i + 1}
              </span>
              <span className="truncate">{item.label}</span>
            </span>

            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              <span
                aria-hidden
                className="rounded-e-[4px] transition-[width] duration-500 ease-out"
                style={{
                  width: `max(${MIN_BAR}px, ${pct}%)`,
                  maxWidth: "calc(100% - 3.5rem)",
                  height: BAR,
                  background: colorOf(item),
                }}
              />
              <span
                dir="ltr"
                className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums"
              >
                {formatCompact(item.value)}
              </span>
            </span>

            {isActive && (
              <div
                className="pointer-events-none absolute bottom-full z-20 mb-1"
                style={{ insetInlineStart: labelWidth }}
              >
                <ChartTooltipBox
                  title={item.label}
                  rows={[
                    {
                      label: valueLabel,
                      value: item.value,
                      color: colorOf(item),
                      kind,
                    },
                    ...(item.extra ?? []).map((e) => ({
                      ...e,
                      color: CHART.muted,
                    })),
                  ]}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
