"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ANIMATION, AXIS_TICK, CHART, formatCompact } from "./chartTheme";
import { ChartLegend, ChartTooltipBox } from "./ChartTooltip";

export interface TrendPoint {
  key: string;
  /** عنوان المحور (يوم/تاريخ مختصر). */
  label: string;
  /** عنوان التلميح الكامل. */
  title: string;
  current: number;
  previous?: number;
}

/**
 * اتجاه مقدار عبر الزمن: مساحة رفيعة للفترة الحالية + خط متقطع للسابقة.
 * RTL: الزمن يبدأ من اليمين (المحور معكوس) والمحور الرأسي على اليمين.
 */
export function TrendChart({
  data,
  currentLabel,
  previousLabel,
  kind = "money",
  height = 260,
}: {
  data: TrendPoint[];
  currentLabel: string;
  previousLabel?: string;
  kind?: "money" | "count";
  height?: number;
}) {
  const withPrev =
    previousLabel !== undefined && data.some((d) => (d.previous ?? 0) !== 0);
  return (
    <div className="space-y-2">
      {withPrev && (
        <ChartLegend
          items={[
            { label: currentLabel, color: CHART.main },
            { label: previousLabel!, color: CHART.muted, dashed: true },
          ]}
        />
      )}
      <div style={{ height }} dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 4, bottom: 0, left: 4 }}
          >
            <defs>
              <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART.main} stopOpacity={0.22} />
                <stop offset="100%" stopColor={CHART.main} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke={CHART.grid}
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="label"
              reversed
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: CHART.grid }}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis
              orientation="right"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatCompact}
              width={44}
              allowDecimals={kind === "money"}
            />
            <Tooltip
              cursor={{
                stroke: CHART.axis,
                strokeWidth: 1,
                strokeDasharray: "4 4",
              }}
              content={({ active, payload }) => {
                const p =
                  active && payload?.[0]
                    ? (payload[0].payload as TrendPoint)
                    : null;
                if (!p) return null;
                return (
                  <ChartTooltipBox
                    title={p.title}
                    rows={[
                      {
                        label: currentLabel,
                        value: p.current,
                        color: CHART.main,
                        kind,
                      },
                      ...(withPrev
                        ? [
                            {
                              label: previousLabel!,
                              value: p.previous ?? 0,
                              color: CHART.muted,
                              kind,
                              dashed: true,
                            },
                          ]
                        : []),
                    ]}
                  />
                );
              }}
            />
            {withPrev && (
              <Line
                type="monotone"
                dataKey="previous"
                stroke={CHART.muted}
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                activeDot={{
                  r: 4,
                  stroke: CHART.surface,
                  strokeWidth: 2,
                  fill: CHART.muted,
                }}
                {...ANIMATION}
              />
            )}
            <Area
              type="monotone"
              dataKey="current"
              stroke={CHART.main}
              strokeWidth={2}
              fill="url(#trend-fill)"
              dot={
                data.length <= 14
                  ? {
                      r: 3,
                      fill: CHART.main,
                      stroke: CHART.surface,
                      strokeWidth: 2,
                    }
                  : false
              }
              activeDot={{
                r: 5,
                fill: CHART.main,
                stroke: CHART.surface,
                strokeWidth: 2,
              }}
              {...ANIMATION}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
