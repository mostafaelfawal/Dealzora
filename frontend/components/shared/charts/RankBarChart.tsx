"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ANIMATION, BAR_RADIUS_H, CHART, formatCompact } from "./chartTheme";
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

const ROW = 30; // ارتفاع كل صف (الاسم والعمود بنفس الارتفاع فيتطابقان)
const BAR = 14;
const VALUE_SPACE = 48; // مساحة رقم القيمة عند طرف العمود

const colorOf = (i: RankItem) => i.color ?? (i.value < 0 ? CHART.bad : CHART.main);

/**
 * ترتيب أفقي بالاتجاه العربي: الاسم على اليمين (HTML حقيقي RTL، يُقصّ بـ … ويظهر كاملاً بالمرور)،
 * والعمود يبدأ بجوار الاسم ويمتد لليسار، والقيمة مكتوبة عند طرفه.
 *
 * الأسماء خارج SVG عمداً: نص SVG داخل حاوية LTR (التي يحتاجها Recharts لحساباته)
 * يكسر اتجاه العربي والأقواس ويقص الأسماء الطويلة.
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
  const height = items.length * ROW;

  return (
    <div className="flex items-stretch gap-2" dir="rtl">
      <ul className="shrink-0" style={{ width: labelWidth }}>
        {items.map((item, i) => (
          <li
            key={item.key}
            title={item.label}
            className="flex items-center gap-1.5 text-xs"
            style={{ height: ROW }}
          >
            <span className="w-4 shrink-0 font-mono text-[10px] text-muted-foreground">{i + 1}</span>
            <span className="truncate">{item.label}</span>
          </li>
        ))}
      </ul>

      <div className="min-w-0 flex-1" style={{ height }} dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={items}
            layout="vertical"
            barSize={BAR}
            margin={{ top: 0, right: 0, bottom: 0, left: VALUE_SPACE }}
          >
            {/* reversed: الصفر على اليمين بجوار الأسماء، والقيم تكبر نحو اليسار. */}
            <XAxis
              type="number"
              reversed
              hide
              domain={[(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)]}
            />
            <YAxis type="category" dataKey="key" hide />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={({ active, payload }) => {
                const p = active && payload?.[0] ? (payload[0].payload as RankItem) : null;
                if (!p) return null;
                return (
                  <ChartTooltipBox
                    title={p.label}
                    rows={[
                      { label: valueLabel, value: p.value, color: colorOf(p), kind },
                      ...(p.extra ?? []).map((e) => ({ ...e, color: CHART.muted })),
                    ]}
                  />
                );
              }}
            />
            <Bar
              dataKey="value"
              radius={BAR_RADIUS_H}
              minPointSize={2}
              label={{
                position: "left",
                offset: 6,
                fill: "var(--muted-foreground)",
                fontSize: 11,
                formatter: (v: unknown) => formatCompact(Number(v)),
              }}
              {...ANIMATION}
            >
              {items.map((d) => (
                <Cell key={d.key} fill={colorOf(d)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
