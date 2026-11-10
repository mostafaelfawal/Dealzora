"use client";

import { useState } from "react";

import { periodOf, type PeriodValue } from "@/components/shared/PeriodPicker";
import { useSessionUser } from "@/hooks/useShellData";
import { formatDate, parseIsoDay } from "@/lib/dates";
import { extractErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

import { useOverview } from "../hooks/useOverview";
import type { Overview } from "../types/dashboard";
import {
  CashFlowCard,
  CategoriesCard,
  ExpensesBreakdownCard,
  PaymentsCard,
  PeakHoursCard,
  TopProductsCard,
} from "./dashboardBreakdowns";
import { DashboardCashiers } from "./dashboardCashiers";
import { DashboardHeader } from "./dashboardHeader";
import { DashboardHealth } from "./dashboardHealth";
import { DashboardInsights } from "./dashboardInsights";
import { DashboardKpiGrid } from "./dashboardKpiGrid";
import { DashboardQuickActions } from "./dashboardQuickActions";
import { DashboardRecentSales } from "./dashboardRecentSales";
import { DashboardError, DashboardSkeleton } from "./dashboardStates";
import { DashboardTrend } from "./dashboardTrend";

const isoLabel = (iso: string) => formatDate(parseIsoDay(iso));

function PeriodCaption({ o }: { o: Overview }) {
  return (
    <p className="text-[11px] text-muted-foreground">
      الفترة {isoLabel(o.dateFrom)} – {isoLabel(o.dateTo)} · المقارنة مع{" "}
      {isoLabel(o.prevFrom)} – {isoLabel(o.prevTo)}
    </p>
  );
}

/** محتوى اللوحة بعد وصول البيانات، مرتّب من الأهم للأقل. */
function DashboardBody({
  o,
  singleDay,
  isStale,
}: {
  o: Overview;
  singleDay: boolean;
  isStale: boolean;
}) {
  return (
    <div
      aria-busy={isStale}
      className={cn(
        "flex flex-col gap-4 transition-opacity",
        isStale && "opacity-60",
      )}
    >
      <PeriodCaption o={o} />

      <DashboardKpiGrid o={o} />

      <div className="grid gap-4 lg:grid-cols-3">
        <DashboardTrend o={o} singleDay={singleDay} />
        <DashboardInsights o={o} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <PeakHoursCard heatmap={o.heatmap} />
        <PaymentsCard payments={o.payments} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TopProductsCard products={o.topProducts} />
        <CategoriesCard categories={o.categories} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <CashFlowCard cashFlow={o.cashFlow} />
        <ExpensesBreakdownCard expenses={o.expensesByCategory} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <DashboardCashiers cashiers={o.cashiers} />
        <DashboardHealth health={o.health} />
      </div>

      <DashboardRecentSales sales={o.recentSales} />
    </div>
  );
}

/** لوحة المدير: أين أنا الآن، ما الذي تغيّر، أين الربح، ومتى الذروة، وما الذي يحتاج تصرفاً. */
export function DashboardScreen() {
  const user = useSessionUser();
  const [period, setPeriod] = useState<PeriodValue>(periodOf("week"));
  const overview = useOverview(period.range);
  const o = overview.data;

  function renderContent() {
    if (o) {
      return (
        <DashboardBody
          o={o}
          singleDay={period.range.from === period.range.to}
          isStale={overview.isFetching && overview.isPlaceholderData}
        />
      );
    }
    if (overview.isError) {
      return (
        <DashboardError
          message={extractErrorMessage(overview.error, "تعذّر تحميل اللوحة")}
          onRetry={() => overview.refetch()}
        />
      );
    }
    return <DashboardSkeleton />;
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <DashboardHeader
        userName={user.name}
        shift={o?.shift}
        period={period}
        onPeriodChange={setPeriod}
      />
      <DashboardQuickActions />
      {renderContent()}
    </div>
  );
}
