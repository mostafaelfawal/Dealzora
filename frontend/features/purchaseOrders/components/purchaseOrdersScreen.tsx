"use client";

import { IconArrowRight } from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { Button } from "@/components/ui/button";
import { PURCHASE_ROUTES } from "@/features/purchases/config/purchaseRoutes";

import { useOrdersSummary, useSuggestions } from "../hooks/usePurchaseOrders";
import { useReorderSettings } from "../hooks/useReorderSettings";
import { OrdersList } from "./ordersList";
import { ReorderSuggestions } from "./reorderSuggestions";

type Tab = "suggestions" | "orders";

/** طلبات الشراء الذكية: النواقص المتوقعة من سرعة البيع ← طلب لكل مورد ← استلام كفاتورة شراء. */
export function PurchaseOrdersScreen() {
  const [tab, setTab] = useState<Tab>("suggestions");
  const summary = useOrdersSummary().data;
  const { settings, update } = useReorderSettings();
  // نفس مفتاح الاستعلام داخل الاقتراحات: لا طلب إضافي، فقط عدد التبويب.
  const suggestions = useSuggestions(settings).data;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <PageHeader
        title="طلبات الشراء"
        description="النواقص تُحسب من سرعة بيع كل صنف فعلياً، وتُجمع حسب آخر مورد اشتريت منه. راجع الكميات وأرسل الطلب للمورد، وعند وصول البضاعة حوّله لفاتورة شراء."
        actions={
          <Button
            variant="outline"
            size="lg"
            nativeButton={false}
            render={<Link href={PURCHASE_ROUTES.list} />}
            className="h-10 gap-2 font-normal"
          >
            <IconArrowRight className="size-4" />
            المشتريات
          </Button>
        }
      />

      <SegmentedTabs
        label="القسم"
        items={[
          {
            id: "suggestions",
            label: "النواقص المقترحة",
            count: suggestions?.totals.count,
          },
          {
            id: "orders",
            label: "الطلبات",
            count: summary ? summary.draft + summary.sent : undefined,
          },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "suggestions" ? (
        <ReorderSuggestions settings={settings} onSettingsChange={update} />
      ) : (
        <OrdersList onGoSuggestions={() => setTab("suggestions")} />
      )}
    </div>
  );
}
