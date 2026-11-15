"use client";

import { useState } from "react";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { ChartCard } from "@/components/shared/charts/ChartCard";
import { RankBarChart } from "@/components/shared/charts/RankBarChart";
import { Money } from "@/components/shared/Money";
import { OptionSelect } from "@/components/shared/OptionSelect";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import type { DateRange } from "@/lib/dates";
import { formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  ALL_CATEGORIES,
  PRODUCT_RANKS,
  REPORT_LIMITS,
} from "../config/reportOptions";
import { useProductsReport } from "../hooks/useReports";
import { isQtyRank, marginPct, productRankItems } from "../lib/reportSeries";
import type { CategorySales, ProductRank, ProductRow } from "../types/report";
import {
  ReportLoading,
  ReportPanel,
  ReportTableHead,
  reportTd as td,
} from "./reportPanel";

const COLUMNS = ["الصنف", "الكمية", "الإيراد", "الربح", "الرصيد"];
const CATEGORY_COLUMNS = ["القسم", "أصناف بيعت", "الإيراد", "الربح", "الهامش", "الحصة"];

function ProductsTable({ rows }: { rows: ProductRow[] }) {
  return (
    <ReportPanel title="الأرقام">
      <div className="overflow-x-auto">
        <table className="w-full min-w-120">
          <ReportTableHead columns={COLUMNS} />
          <tbody>
            {rows.map((r) => (
              <tr key={r.productId} className="border-b last:border-0">
                <AppTooltip message={r.name} onlyWhenTruncated>
                  <td className={cn(td, "max-w-40 truncate")}>{r.name}</td>
                </AppTooltip>
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

/** المبيعات حسب القسم: أين يأتي الإيراد وأي قسم هامشه أعلى. */
function CategoriesTable({
  categories,
  selected,
  onSelect,
}: {
  categories: CategorySales[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const total = categories.reduce((sum, c) => sum + c.revenue, 0);
  return (
    <ReportPanel title="المبيعات حسب القسم (اضغط على قسم لعرض أصنافه)">
      <div className="overflow-x-auto">
        <table className="w-full min-w-130">
          <ReportTableHead columns={CATEGORY_COLUMNS} />
          <tbody>
            {categories.map((c) => (
              <tr
                key={c.id}
                onClick={() => onSelect(selected === c.id ? ALL_CATEGORIES : c.id)}
                className={cn(
                  "cursor-pointer border-b last:border-0 hover:bg-muted/40",
                  selected === c.id && "bg-primary/5",
                )}
              >
                <td className={cn(td, "font-medium")}>{c.name}</td>
                <td className={cn(td, "font-mono")}>{c.products}</td>
                <td className={td}>
                  <Money amount={c.revenue} className="text-xs" />
                </td>
                <td className={td}>
                  <Money
                    amount={c.profit}
                    className={cn(
                      "text-xs",
                      c.profit < 0 && "text-destructive",
                    )}
                  />
                </td>
                <td className={cn(td, "font-mono")}>
                  {c.revenue ? `${marginPct(c.profit, c.revenue)}%` : "—"}
                </td>
                <td className={cn(td, "font-mono text-muted-foreground")}>
                  {total ? `${Math.round((c.revenue / total) * 100)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportPanel>
  );
}

export function ProductsReportTab({ range }: { range: DateRange }) {
  const [rank, setRank] = useState<ProductRank>("top");
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const q = useProductsReport(
    range,
    rank,
    category === ALL_CATEGORIES ? null : category,
  );
  const option = PRODUCT_RANKS.find((r) => r.id === rank)!;

  if (!q.data)
    return <ReportLoading error={q.error} onRetry={() => q.refetch()} />;
  const { items, categories } = q.data;
  const categoryItems = [
    { value: ALL_CATEGORIES, label: "كل الأقسام" },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedTabs
          label="ترتيب الأصناف"
          items={PRODUCT_RANKS}
          value={rank}
          onChange={setRank}
        />
        <OptionSelect
          label="القسم"
          items={categoryItems}
          value={category}
          onChange={setCategory}
          className="w-48"
        />
      </div>

      {items.length === 0 ? (
        <p className="border border-dashed py-12 text-center text-sm text-muted-foreground">
          لا توجد مبيعات في هذه الفترة
          {category !== ALL_CATEGORIES && " لهذا القسم"}
        </p>
      ) : (
        <div
          className={cn(
            "grid gap-3 lg:grid-cols-2 transition-opacity",
            q.isPlaceholderData && "opacity-60",
          )}
        >
          <ChartCard
            title={option.label}
            subtitle={`أعلى ${REPORT_LIMITS.productsChart} صنفاً؛ الجدول بجانبه فيه الكل`}
          >
            <RankBarChart
              valueLabel={option.valueLabel}
              kind={isQtyRank(rank) ? "qty" : "money"}
              items={productRankItems(items, rank)}
            />
          </ChartCard>
          <ProductsTable rows={items} />
        </div>
      )}

      <CategoriesTable
        categories={categories}
        selected={category}
        onSelect={setCategory}
      />
    </div>
  );
}
