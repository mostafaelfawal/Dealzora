"use client";

import type { PeriodValue } from "@/components/shared/PeriodPicker";

import type { ReportTab } from "../types/report";
import { BranchesReportTab } from "./branchesReportTab";
import { DebtsReportTab } from "./debtsReportTab";
import {
  CashiersReportTab,
  CustomersReportTab,
  PromotionsReportTab,
  PurchasesReportTab,
  ReturnsReportTab,
} from "./extendedReportTabs";
import { ProductsReportTab } from "./productsReportTab";
import { SalesReportTab } from "./salesReportTab";
import { StockReportTab } from "./stockReportTab";
import { TreasuryReportTab } from "./treasuryReportTab";

/** محتوى تبويب واحد (للشاشة ولملف الـ PDF). */
export function ReportTabContent({
  tab,
  period,
}: {
  tab: ReportTab;
  period: PeriodValue;
}) {
  switch (tab) {
    case "sales":
      return <SalesReportTab range={period.range} />;
    case "products":
      return <ProductsReportTab range={period.range} />;
    case "purchases":
      return <PurchasesReportTab range={period.range} />;
    case "promotions":
      return <PromotionsReportTab range={period.range} />;
    case "returns":
      return <ReturnsReportTab range={period.range} />;
    case "customers":
      return <CustomersReportTab range={period.range} />;
    case "cashiers":
      return <CashiersReportTab range={period.range} />;
    case "stock":
      return <StockReportTab />;
    case "debts":
      return <DebtsReportTab />;
    case "treasury":
      return <TreasuryReportTab range={period.range} />;
    case "branches":
      return <BranchesReportTab range={period.range} />;
  }
}
