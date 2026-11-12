"use client";

import {
  IconCash,
  IconChartLine,
  IconCoin,
  IconReceipt,
  IconReceiptRefund,
  IconShoppingBag,
  IconTrendingDown,
  IconTrendingUp,
  IconWallet,
} from "@tabler/icons-react";

import { Money } from "@/components/shared/Money";
import { formatNumber, formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

import { discountSharePct, sparkPoints } from "../lib/dashboardSeries";
import { marginPct } from "../lib/insights";
import type { Overview } from "../types/dashboard";
import { KpiCard } from "./kpiCard";

const MONEY_CLASS = "text-xl";

/** المؤشرات الرئيسية الثمانية، كل منها مقارنة بالفترة السابقة. */
export function DashboardKpiGrid({ o }: { o: Overview }) {
  const { kpis: k, prev, trend } = o;
  const discountShare = discountSharePct(k.netSales, k.discounts);

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <KpiCard
        index={0}
        icon={<IconReceipt />}
        label="صافي المبيعات"
        current={k.netSales}
        previous={prev.netSales}
        spark={{
          points: sparkPoints(
            trend,
            (t) => t.net,
            (t) => t.prevNet,
          ),
          note: "صافي المبيعات لكل يوم في الفترة (بعد خصم المرتجعات). مرّر على الخط لترى أي يوم.",
        }}
        hint={
          `كاش ${formatNumber(k.cashSales)} · آجل ${formatNumber(k.creditSales)}` +
          (k.walletSales ? ` · محافظ ${formatNumber(k.walletSales)}` : "")
        }
      >
        <Money amount={k.netSales} className={MONEY_CLASS} />
      </KpiCard>

      <KpiCard
        index={1}
        icon={<IconCoin />}
        label="مجمل الربح"
        current={k.grossProfit}
        previous={prev.grossProfit}
        spark={{
          points: sparkPoints(
            trend,
            (t) => t.profit,
            (t) => t.prevProfit,
          ),
          note: "الربح اليومي = المبيعات − تكلفة البضاعة المباعة (قبل المصروفات).",
        }}
        hint={`هامش ${marginPct(k)}% من المبيعات`}
      >
        <Money amount={k.grossProfit} className={MONEY_CLASS} />
      </KpiCard>

      <KpiCard
        index={2}
        icon={k.netProfit >= 0 ? <IconTrendingUp /> : <IconTrendingDown />}
        label="صافي الربح بعد المصروفات"
        current={k.netProfit}
        previous={prev.netProfit}
        hint={`المصروفات ${formatNumber(k.expenses)}`}
      >
        <Money
          amount={k.netProfit}
          className={cn(MONEY_CLASS, k.netProfit < 0 && "text-destructive")}
        />
      </KpiCard>

      <KpiCard
        index={3}
        icon={<IconShoppingBag />}
        label="عدد الفواتير"
        current={k.invoices}
        previous={prev.invoices}
        spark={{
          points: sparkPoints(trend, (t) => t.invoices),
          note: "عدد فواتير البيع في كل يوم. انخفاضه مع ثبات المبيعات = فواتير أكبر.",
          kind: "count",
        }}
        hint={`${formatQty(k.itemsSold)} وحدة مباعة`}
      >
        <span className="font-mono">{k.invoices}</span>
      </KpiCard>

      <KpiCard
        index={4}
        icon={<IconChartLine />}
        label="متوسط الفاتورة"
        current={k.avgTicket}
        previous={prev.avgTicket}
        hint="ارفعه بعروض الكميات والأصناف المكمّلة"
      >
        <Money amount={k.avgTicket} className={MONEY_CLASS} />
      </KpiCard>

      <KpiCard
        index={5}
        icon={<IconWallet />}
        label="الخصومات الممنوحة"
        current={k.discounts}
        previous={prev.discounts}
        inverse
        hint={
          discountShare === null ? undefined : `${discountShare}% من قيمة البيع`
        }
      >
        <Money amount={k.discounts} className={MONEY_CLASS} />
      </KpiCard>

      <KpiCard
        index={6}
        icon={<IconReceiptRefund />}
        label="المرتجعات"
        current={k.returns}
        previous={prev.returns}
        inverse
      >
        <Money amount={k.returns} className={MONEY_CLASS} />
      </KpiCard>

      <KpiCard
        index={7}
        icon={<IconCash />}
        label="المصروفات"
        current={k.expenses}
        previous={prev.expenses}
        inverse
      >
        <Money amount={k.expenses} className={MONEY_CLASS} />
      </KpiCard>
    </div>
  );
}
