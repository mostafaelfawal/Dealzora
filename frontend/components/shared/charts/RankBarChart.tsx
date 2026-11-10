"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  ANIMATION,
  AXIS_TICK,
  BAR_RADIUS_H,
  CHART,
  formatCompact,
} from "./chartTheme";
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

const BAR = 14;
const ROW = 30;
const MAX_LABEL = 18;

/**
 * ترتيب (الأعلى أولاً): أعمدة أفقية رفيعة بلون واحد، الاسم على اليمين (RTL)
 * والقيمة مكتوبة عند طرف العمود. القيم السالبة (خسارة) بلون الخطر مع ظهورها نصاً.
 */
export function RankBarChart({
  items,
  valueLabel,
  kind = "money",
}: {
  items: RankItem[];
  valueLabel: string;
  kind?: TooltipRow["kind"];
}) {
  const data = items.map((i) => ({
    ...i,
    short:
      i.label.length > MAX_LABEL ? `${i.label.slice(0, MAX_LABEL)}…` : i.label,
  }));
  return (
    <div style={{ height: Math.max(data.length * ROW + 8, 80) }} dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 4, bottom: 0, left: 36 }}
          barSize={BAR}
        >
          <XAxis
            type="number"
            reversed
            hide
            domain={[
              (min: number) => Math.min(0, min),
              (max: number) => Math.max(0, max),
            ]}
          />
          <YAxis
            type="category"
            dataKey="short"
            orientation="right"
            width={120}
            tick={{ ...AXIS_TICK, fill: "var(--foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            content={({ active, payload }) => {
              const p =
                active && payload?.[0]
                  ? (payload[0].payload as RankItem)
                  : null;
              if (!p) return null;
              return (
                <ChartTooltipBox
                  title={p.label}
                  rows={[
                    {
                      label: valueLabel,
                      value: p.value,
                      color: p.color ?? (p.value < 0 ? CHART.bad : CHART.main),
                      kind,
                    },
                    ...(p.extra ?? []).map((e) => ({
                      ...e,
                      color: CHART.muted,
                    })),
                  ]}
                />
              );
            }}
          />
          <Bar
            dataKey="value"
            radius={BAR_RADIUS_H}
            label={{
              position: "left",
              fill: "var(--muted-foreground)",
              fontSize: 11,
              formatter: (v: unknown) => formatCompact(Number(v)),
            }}
            {...ANIMATION}
          >
            {data.map((d) => (
              <Cell
                key={d.key}
                fill={d.color ?? (d.value < 0 ? CHART.bad : CHART.main)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
