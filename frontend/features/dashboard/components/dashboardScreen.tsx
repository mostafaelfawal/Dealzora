"use client";

import { useState } from "react";

import { periodOf, type PeriodValue } from "@/components/shared/PeriodPicker";
import { useSessionUser } from "@/hooks/useShellData";
import { formatDate, parseIsoDay } from "@/lib/dates";
import { extractErrorMessage } from "@/lib/errors";
import { useFeature } from "@/lib/plan";
import { cn } from "@/lib/utils";

import { DashboardEReceiptAlert } from "@/features/eta/components/eReceiptWidgets";

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
import {
  ExpiryCard,
  LockedFeaturesNote,
  LoyaltyCard,
  PromotionsCard,
  PurchasingCard,
  ReturnReasonsCard,
  TopCustomersCard,
} from "./dashboardModules";
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
  const moduleCards = useModuleCards(o);
  // ما خارج الخطة يختفي، إلا لو فيه بيانات فعلية (من قبل نزول الخطة).
  const showExpenses = useFeature("expenses") || o.expensesByCategory.length > 0;
  const showCashiers = useFeature("multi_user") || o.cashiers.length > 1;
  return (
    <div
      aria-busy={isStale}
      className={cn(
        "flex flex-col gap-4 transition-opacity",
        isStale && "opacity-60",
      )}
    >
      <PeriodCaption o={o} />

      <DashboardEReceiptAlert />

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
        <PromotionsCard promotions={o.promotions} invoices={o.kpis.invoices} />
        <ReturnReasonsCard reasons={o.returnReasons} />
      </div>

      {/* أقسام حسب الخطة: تظهر فقط لو الـ backend أرسلها. */}
      {moduleCards.length > 0 && (
        <div
          className={cn(
            "grid gap-4",
            moduleCards.length === 2 && "lg:grid-cols-2",
            moduleCards.length >= 3 && "md:grid-cols-2 xl:grid-cols-3",
          )}
        >
          {moduleCards}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <CashFlowCard
          cashFlow={o.cashFlow}
          className={showExpenses ? undefined : "lg:col-span-3"}
        />
        {showExpenses && (
          <ExpensesBreakdownCard expenses={o.expensesByCategory} />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {showCashiers && <DashboardCashiers cashiers={o.cashiers} />}
        <DashboardHealth health={o.health} />
        {!showCashiers && (
          <div className="lg:col-span-2">
            <DashboardRecentSales sales={o.recentSales} />
          </div>
        )}
      </div>

      {showCashiers && <DashboardRecentSales sales={o.recentSales} />}

      <LockedFeaturesNote />
    </div>
  );
}

/** بطاقات الميزات الإضافية الموجودة في خطة المحل، بترتيب الأهمية. */
function useModuleCards(o: Overview) {
  const cards = [];
  if (o.expiry) cards.push(<ExpiryCard key="expiry" expiry={o.expiry} />);
  if (o.customers)
    cards.push(<TopCustomersCard key="customers" customers={o.customers} />);
  if (o.loyalty) cards.push(<LoyaltyCard key="loyalty" loyalty={o.loyalty} />);
  if (o.purchasing)
    cards.push(
      <PurchasingCard key="purchasing" purchasing={o.purchasing} />,
    );
  return cards;
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
