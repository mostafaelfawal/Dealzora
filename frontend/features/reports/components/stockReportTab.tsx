"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { ChartCard } from "@/components/shared/charts/ChartCard";
import { RankBarChart } from "@/components/shared/charts/RankBarChart";
import { Money } from "@/components/shared/Money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStockReport } from "@/features/inventory/hooks/useInventory";
import { formatQty } from "@/lib/format";

import { REPORT_LIMITS } from "../config/reportOptions";
import { topBy } from "../lib/reportSeries";
import { ReportListEmpty, ReportLoading, ReportPanel } from "./reportPanel";

type StockReport = NonNullable<ReturnType<typeof useStockReport>["data"]>;
type StockRow = StockReport["low"][number];

function StockList({
  rows,
  renderValue,
}: {
  rows: StockRow[];
  renderValue: (row: StockRow) => ReactNode;
}) {
  return (
    <ul className="divide-y">
      {rows.length === 0 && <ReportListEmpty text="لا يوجد" />}
      {rows.slice(0, REPORT_LIMITS.stockList).map((row) => (
        <li
          key={row.productId}
          className="flex items-center justify-between gap-3 py-2 text-xs"
        >
          <span className="min-w-0 truncate">{row.name}</span>
          {renderValue(row)}
        </li>
      ))}
    </ul>
  );
}

function StagnantChart({ rows }: { rows: StockRow[] }) {
  const items = topBy(rows, (r) => r.stockValue, REPORT_LIMITS.topChart).map(
    (row) => ({
      key: row.productId,
      label: row.name,
      value: row.stockValue,
      extra: [
        {
          label: `الرصيد (${row.unit})`,
          value: row.stock,
          kind: "qty" as const,
        },
      ],
    }),
  );
  return (
    <ChartCard
      title="أين تتجمد الأموال؟"
      subtitle="أكبر الأصناف الراكدة بقيمتها بسعر الشراء — مرشحة لعرض أو خصم"
    >
      <RankBarChart valueLabel="القيمة المجمّدة" items={items} />
    </ChartCard>
  );
}

export function StockReportTab() {
  const q = useStockReport(REPORT_LIMITS.stagnantDays);
  if (!q.data)
    return <ReportLoading error={q.error} onRetry={() => q.refetch()} />;
  const r = q.data;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-3">
        <ReportPanel title={`قارب على النفاد (${r.low.length})`}>
          <StockList
            rows={r.low}
            renderValue={(row) => (
              <span className="font-mono text-warning">
                {formatQty(row.stock)} / {formatQty(row.minStock)} {row.unit}
              </span>
            )}
          />
        </ReportPanel>

        <ReportPanel title={`نفد (${r.out.length})`}>
          <StockList
            rows={r.out}
            renderValue={() => (
              <Badge
                variant="outline"
                className="border-destructive/50 font-normal text-destructive"
              >
                نفد
              </Badge>
            )}
          />
        </ReportPanel>

        <ReportPanel
          title={`راكد ${REPORT_LIMITS.stagnantDays} يوماً (${r.stagnant.length})`}
        >
          <StockList
            rows={r.stagnant}
            renderValue={(row) => (
              <Money amount={row.stockValue} className="text-xs" />
            )}
          />
          {r.stagnant.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              أموال مجمّدة في الراكد:{" "}
              <Money amount={r.stagnantValue} className="text-[11px]" />
            </p>
          )}
        </ReportPanel>
      </div>

      {r.stagnant.length > 0 && <StagnantChart rows={r.stagnant} />}

      <Button
        variant="outline"
        nativeButton={false}
        render={<Link href="/admin/inventory" />}
      >
        فتح صفحة المخزون للجرد والتعديل
      </Button>
    </div>
  );
}
