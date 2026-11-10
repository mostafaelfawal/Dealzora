"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { m } from "framer-motion";

import { cn } from "@/lib/utils";

import { tBase } from "../motion";
import { ANIMATION, AXIS_TICK, BAR_RADIUS, CHART, formatCompact, formatFull } from "./chartTheme";
import { ChartLegend, ChartTooltipBox } from "./ChartTooltip";

/* ================= خط صغير داخل بطاقة رقم (بدون محاور) ================= */
export function Sparkline({ values, height = 32 }: { values: number[]; height?: number }) {
  if (values.length < 2) return null;
  const data = values.map((v, i) => ({ i, v }));
  return (
    <div style={{ height }} aria-hidden dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <XAxis dataKey="i" reversed hide />
          <Area
            type="monotone"
            dataKey="v"
            stroke={CHART.main}
            strokeWidth={1.5}
            fill={CHART.main}
            fillOpacity={0.08}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ================= حلقة توزيع (جزأين أو ثلاثة فقط) ================= */
export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

/** حلقة بفواصل 2px، والمجموع في المنتصف، والنِّسب مكتوبة في وسيلة الإيضاح (الهوية ليست لوناً فقط). */
export function Donut({
  slices,
  centerLabel,
  centerValue,
  height = 180,
}: {
  slices: DonutSlice[];
  centerLabel: string;
  centerValue: string;
  height?: number;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: height, height }} dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={total > 0 ? slices : [{ key: "empty", label: "", value: 1, color: CHART.grid }]}
              dataKey="value"
              nameKey="label"
              innerRadius="68%"
              outerRadius="100%"
              paddingAngle={total > 0 && slices.filter((s) => s.value > 0).length > 1 ? 2 : 0}
              stroke={CHART.surface}
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              {...ANIMATION}
            >
              {(total > 0 ? slices : [{ key: "empty", color: CHART.grid }]).map((s) => (
                <Cell key={s.key} fill={s.color} />
              ))}
            </Pie>
            {total > 0 && (
              <Tooltip
                content={({ active, payload }) => {
                  const p = active && payload?.[0] ? (payload[0].payload as DonutSlice) : null;
                  if (!p) return null;
                  return (
                    <ChartTooltipBox
                      title={`${p.label} · ${pct(p.value)}%`}
                      rows={[{ label: p.label, value: p.value, color: p.color }]}
                    />
                  );
                }}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] text-muted-foreground">{centerLabel}</span>
          <span dir="ltr" className="font-mono text-base font-semibold">{centerValue}</span>
        </div>
      </div>
      <ul className="w-full space-y-2 text-xs">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span aria-hidden className="size-2.5 rounded-[2px]" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="text-end">
              <span dir="ltr" className="font-mono font-semibold">{formatFull(s.value)}</span>
              <span className="ms-1.5 text-muted-foreground">{pct(s.value)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ================= داخل/خارج يومياً (متباعد حول الصفر) ================= */
export interface FlowPoint {
  key: string;
  label: string;
  title: string;
  inflow: number;
  outflow: number;
}

/** الداخل فوق الصفر (أخضر) والخارج تحته (أحمر) — ألوان حالة محجوزة مع وسيلة إيضاح نصية. */
export function CashFlowChart({ data, height = 220 }: { data: FlowPoint[]; height?: number }) {
  const rows = data.map((d) => ({ ...d, out: -d.outflow }));
  return (
    <div className="space-y-2">
      <ChartLegend
        items={[
          { label: "داخل الخزنة", color: CHART.good },
          { label: "خارج الخزنة", color: CHART.bad },
        ]}
      />
      <div style={{ height }} dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} stackOffset="sign" margin={{ top: 4, right: 4, bottom: 0, left: 4 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke={CHART.grid} strokeDasharray="3 3" />
            <XAxis dataKey="label" reversed tick={AXIS_TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
            <YAxis orientation="right" tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatCompact(Math.abs(v))} width={44} />
            <ReferenceLine y={0} stroke={CHART.axis} strokeOpacity={0.5} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={({ active, payload }) => {
                const p = active && payload?.[0] ? (payload[0].payload as FlowPoint) : null;
                if (!p) return null;
                return (
                  <ChartTooltipBox
                    title={p.title}
                    rows={[
                      { label: "داخل", value: p.inflow, color: CHART.good },
                      { label: "خارج", value: p.outflow, color: CHART.bad },
                      { label: "الصافي", value: p.inflow - p.outflow, color: CHART.main },
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="inflow" stackId="flow" fill={CHART.good} radius={BAR_RADIUS} maxBarSize={22} {...ANIMATION} />
            <Bar dataKey="out" stackId="flow" fill={CHART.bad} radius={[0, 0, 4, 4]} maxBarSize={22} {...ANIMATION} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ================= أعمدة رأسية لسلسلة واحدة (ساعات اليوم…) ================= */
export function ColumnChart({
  data,
  valueLabel,
  kind = "money",
  height = 160,
  highlightMax = true,
}: {
  data: { key: string; label: string; title: string; value: number }[];
  valueLabel: string;
  kind?: "money" | "count";
  height?: number;
  highlightMax?: boolean;
}) {
  const max = Math.max(...data.map((d) => d.value), 0);
  return (
    <div style={{ height }} dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }} barCategoryGap="20%">
          <CartesianGrid vertical={false} stroke={CHART.grid} strokeDasharray="3 3" />
          <XAxis dataKey="label" reversed tick={AXIS_TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={8} />
          <YAxis orientation="right" tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={formatCompact} width={40} allowDecimals={kind === "money"} />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            content={({ active, payload }) => {
              const p = active && payload?.[0] ? (payload[0].payload as { title: string; value: number }) : null;
              if (!p) return null;
              return <ChartTooltipBox title={p.title} rows={[{ label: valueLabel, value: p.value, color: CHART.main, kind }]} />;
            }}
          />
          <Bar dataKey="value" radius={BAR_RADIUS} maxBarSize={18} {...ANIMATION}>
            {data.map((d) => (
              <Cell
                key={d.key}
                fill={CHART.main}
                fillOpacity={highlightMax && max > 0 && d.value !== max ? 0.55 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ================= خريطة أوقات الذروة (يوم × ساعة) ================= */
export const WEEKDAYS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

const hourLabel = (h: number) => {
  const suffix = h < 12 ? "ص" : "م";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}${suffix}`;
};

/**
 * تدرّج لون واحد (فاتح ← غامق) لعدد الفواتير. الساعات بلا أي بيع في كل الأيام تُطوى
 * حتى لا تضيع المساحة. المرور على خانة يعرض الأرقام.
 */
export function PeakHeatmap({
  cells,
}: {
  cells: { weekday: number; hour: number; invoices: number; net: number }[];
}) {
  const [hover, setHover] = useState<{ weekday: number; hour: number } | null>(null);
  const map = new Map(cells.map((c) => [`${c.weekday}-${c.hour}`, c]));
  const active = cells.map((c) => c.hour);
  const from = active.length ? Math.max(Math.min(...active) - 1, 0) : 8;
  const to = active.length ? Math.min(Math.max(...active) + 1, 23) : 22;
  const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const max = Math.max(...cells.map((c) => c.invoices), 0);
  const level = (n: number) => (n <= 0 || max === 0 ? -1 : Math.min(4, Math.floor((n / max) * 4.999)));
  const hovered = hover ? map.get(`${hover.weekday}-${hover.hour}`) : null;

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-separate" style={{ borderSpacing: 2 }}>
          <thead>
            <tr>
              <th className="w-14" />
              {hours.map((h) => (
                <th key={h} className="text-center text-[10px] font-normal text-muted-foreground">
                  {h % 2 === from % 2 ? hourLabel(h) : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WEEKDAYS.map((day, w) => (
              <tr key={day}>
                <th className="pe-1 text-start text-[11px] font-normal text-muted-foreground">{day}</th>
                {hours.map((h) => {
                  const c = map.get(`${w}-${h}`);
                  const l = level(c?.invoices ?? 0);
                  return (
                    <td key={h} className="p-0">
                      <m.button
                        type="button"
                        aria-label={`${day} ${hourLabel(h)}: ${c?.invoices ?? 0} فاتورة`}
                        onMouseEnter={() => setHover({ weekday: w, hour: h })}
                        onMouseLeave={() => setHover(null)}
                        onFocus={() => setHover({ weekday: w, hour: h })}
                        onBlur={() => setHover(null)}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ ...tBase, delay: (w * hours.length + (h - from)) * 0.002 }}
                        className={cn(
                          "block h-6 w-full rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          l < 0 && "bg-muted/60",
                          hover?.weekday === w && hover?.hour === h && "ring-2 ring-foreground/60",
                        )}
                        style={l >= 0 ? { background: CHART.seq[l] } : undefined}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span aria-live="polite" className="min-h-4">
          {hover
            ? `${WEEKDAYS[hover.weekday]} ${hourLabel(hover.hour)}: ${hovered?.invoices ?? 0} فاتورة · ${formatFull(hovered?.net ?? 0)} ج.م`
            : "مرّر على أي خانة لرؤية الأرقام"}
        </span>
        <span className="flex items-center gap-1.5">
          أقل
          {CHART.seq.map((c) => (
            <span key={c} aria-hidden className="size-3 rounded-[2px] border border-border/50" style={{ background: c }} />
          ))}
          أكثر
        </span>
      </div>
    </div>
  );
}
