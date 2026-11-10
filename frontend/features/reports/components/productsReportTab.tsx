"use client";

import { useState } from "react";

import { ChartCard } from "@/components/shared/charts/ChartCard";
import { RankBarChart } from "@/components/shared/charts/RankBarChart";
import { Money } from "@/components/shared/Money";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import type { DateRange } from "@/lib/dates";
import { formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

import { PRODUCT_RANKS, REPORT_LIMITS } from "../config/reportOptions";
import { useProductsReport } from "../hooks/useReports";
import { isQtyRank, productRankItems } from "../lib/reportSeries";
import type { ProductRank, ProductRow } from "../types/report";
import {
  ReportLoading,
  ReportPanel,
  ReportTableHead,
  reportTd as td,
} from "./reportPanel";

const COLUMNS = ["الصنف", "الكمية", "الإيراد", "الربح", "الرصيد"];

function ProductsTable({ rows }: { rows: ProductRow[] }) {
  return (
    <ReportPanel title="الأرقام">
      <div className="overflow-x-auto">
        <table className="w-full min-w-120">
          <ReportTableHead columns={COLUMNS} />
          <tbody>
            {rows.map((r) => (
              <tr key={r.productId} className="border-b last:border-0">
                <td className={cn(td, "max-w-40 truncate")}>{r.name}</td>
                <td className={cn(td, "font-mono")}>{formatQty(r.qty)}</td>
                <td className={td}>
                  <Money amount={r.revenue} className="text-xs" />
                </td>
                <td className={td}>
                  <Money
                    amount={r.profit}
                    className={cn(
                      "text-xs",
                      r.profit < 0 && "text-destructive",
                    )}
                  />
                </td>
                <td className={cn(td, "font-mono text-muted-foreground")}>
                  {formatQty(r.stock)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportPanel>
  );
}

function ProductsBody({
  range,
  rank,
}: {
  range: DateRange;
  rank: ProductRank;
}) {
  const q = useProductsReport(range, rank);
  const option = PRODUCT_RANKS.find((r) => r.id === rank)!;

  if (!q.data)
    return <ReportLoading error={q.error} onRetry={() => q.refetch()} />;
  if (q.data.length === 0) {
    return (
      <p className="border border-dashed py-12 text-center text-sm text-muted-foreground">
        لا توجد مبيعات في هذه الفترة
      </p>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <ChartCard
        title={option.label}
        subtitle={`أعلى ${REPORT_LIMITS.productsChart} صنفاً؛ الجدول بجانبه فيه الكل`}
      >
        <RankBarChart
          valueLabel={option.valueLabel}
          kind={isQtyRank(rank) ? "qty" : "money"}
          items={productRankItems(q.data, rank)}
        />
      </ChartCard>
      <ProductsTable rows={q.data} />
    </div>
  );
}

export function ProductsReportTab({ range }: { range: DateRange }) {
  const [rank, setRank] = useState<ProductRank>("top");
  return (
    <div className="space-y-3">
      <SegmentedTabs
        label="ترتيب الأصناف"
        items={PRODUCT_RANKS}
        value={rank}
        onChange={setRank}
      />
      <ProductsBody range={range} rank={rank} />
    </div>
  );
}
