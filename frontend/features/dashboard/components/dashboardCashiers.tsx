"use client";

import { ChartCard, ChartEmpty } from "@/components/shared/charts/ChartCard";
import { ProgressBar } from "@/components/shared/motion";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { Cashier } from "../types/dashboard";

const COLUMNS = [
  { label: "الكاشير" },
  { label: "الصافي", className: "w-2/5" },
  { label: "الفواتير" },
  { label: "متوسط الفاتورة" },
  { label: "الخصومات" },
  { label: "المرتجع" },
];

/** خلية مبلغ: يمين على الشاشات الصغيرة لتصطف الأرقام. */
function AmountCell({ value, danger }: { value: number; danger?: boolean }) {
  return (
    <td
      dir="ltr"
      className={cn(
        "text-end font-mono sm:text-start",
        danger && "text-destructive",
      )}
    >
      {formatNumber(value)}
    </td>
  );
}

function CashierRow({ cashier: c, max }: { cashier: Cashier; max: number }) {
  return (
    <tr className="h-11 border-b last:border-0">
      <td className="font-medium">{c.name}</td>
      <td className="pe-4">
        <div className="space-y-1">
          <span dir="ltr" className="font-mono">
            {formatNumber(c.net)}
          </span>
          <ProgressBar
            value={c.net / max}
            barClassName="bg-[var(--chart-main)]"
          />
        </div>
      </td>
      <td className="font-mono">{c.invoices}</td>
      <AmountCell value={c.avgTicket} />
      <AmountCell value={c.discounts} />
      <AmountCell value={c.returns} danger={c.returns > 0} />
    </tr>
  );
}

export function DashboardCashiers({ cashiers }: { cashiers: Cashier[] }) {
  const max = Math.max(...cashiers.map((c) => c.net), 0) || 1;

  return (
    <ChartCard
      index={9}
      title="أداء الكاشيرية"
      subtitle="الصافي بعد المرتجعات، ومتوسط الفاتورة، والخصومات الممنوحة"
      href="/admin/shifts"
      className="lg:col-span-2"
    >
      {cashiers.length === 0 ? (
        <ChartEmpty text="لا توجد مبيعات في هذه الفترة" height={120} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-130 text-xs">
            <thead className="border-b text-muted-foreground">
              <tr className="h-8">
                {COLUMNS.map((col) => (
                  <th
                    key={col.label}
                    className={cn("text-start font-normal", col.className)}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cashiers.map((c) => (
                <CashierRow key={c.userId} cashier={c} max={max} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ChartCard>
  );
}
