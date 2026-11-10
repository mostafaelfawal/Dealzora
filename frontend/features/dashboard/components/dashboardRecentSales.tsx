"use client";

import Link from "next/link";

import { ChartCard, ChartEmpty } from "@/components/shared/charts/ChartCard";
import { Money } from "@/components/shared/Money";
import { listItem, MotionLi } from "@/components/shared/motion";
import { PAYMENT_LABEL } from "@/features/sales/config/saleOptions";
import { formatWhen } from "@/lib/dates";

import type { Overview } from "../types/dashboard";

type RecentSale = Overview["recentSales"][number];

function RecentSaleRow({ sale, index }: { sale: RecentSale; index: number }) {
  return (
    <MotionLi {...listItem(index)}>
      <Link
        href={`/admin/sales?open=${sale.id}`}
        className="flex items-center gap-3 py-2 text-xs hover:bg-muted/40"
      >
        <span className="w-12 font-mono font-semibold">#{sale.number}</span>
        <span className="min-w-0 flex-1 truncate">
          {sale.customerName ?? "عميل نقدي"}
        </span>
        <span className="hidden text-muted-foreground sm:inline">
          {PAYMENT_LABEL[sale.paymentMethod]}
        </span>
        <span className="hidden w-28 text-muted-foreground md:inline">
          {formatWhen(sale.soldAt)}
        </span>
        <Money amount={sale.total} className="text-xs" />
      </Link>
    </MotionLi>
  );
}

export function DashboardRecentSales({ sales }: { sales: RecentSale[] }) {
  return (
    <ChartCard index={11} title="آخر الفواتير" href="/admin/sales">
      {sales.length === 0 ? (
        <ChartEmpty text="لا توجد فواتير بعد" height={100} />
      ) : (
        <ul className="divide-y">
          {sales.map((sale, i) => (
            <RecentSaleRow key={sale.id} sale={sale} index={i} />
          ))}
        </ul>
      )}
    </ChartCard>
  );
}
