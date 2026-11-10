"use client";

import { IconShoppingCartPlus } from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";
import { SHORTCUTS } from "@/config/shortcuts";

import { useSalesFilters } from "../hooks/useSalesFilters";
import type { Sale } from "../types/sale";
import { SaleDetailSheet } from "./saleDetailSheet";
import { SaleReturnDialog } from "./saleReturnDialog";
import { SalesStats } from "./salesStats";
import { SalesTable } from "./salesTable";
import { SalesToolbar } from "./salesToolbar";

/** يفتح فاتورة مباشرة من رابط ?open=<id> (من اللوحة أو البحث العام). */
const initialOpenId = () =>
  typeof window === "undefined"
    ? null
    : new URLSearchParams(window.location.search).get("open");

function NewSaleButton() {
  return (
    <Button
      size="lg"
      nativeButton={false}
      render={<Link href="/pos" />}
      className="h-10 gap-2"
    >
      <IconShoppingCartPlus className="size-4" />
      بيع جديد
      <ShortcutBadge className="hidden border-primary-foreground/30 text-primary-foreground/80 lg:inline-flex">
        {SHORTCUTS.newSale.label}
      </ShortcutBadge>
    </Button>
  );
}

/** سجل الفواتير: بحث برقم الفاتورة أو العميل، فلترة بالفترة وطريقة الدفع، وتفاصيل كل فاتورة. */
export function SalesScreen() {
  const filters = useSalesFilters();
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  const [returning, setReturning] = useState<Sale | null>(null);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <PageHeader
        title="الفواتير"
        description="كل فواتير البيع. اضغط على أي فاتورة لطباعتها أو إرسالها واتساب أو عمل مرتجع منها."
        actions={<NewSaleButton />}
      />

      <SalesStats period={filters.period} onPeriodChange={filters.setPeriod} />
      <SalesToolbar filters={filters} />
      <SalesTable filters={filters} onOpen={setOpenId} />

      <SaleDetailSheet
        saleId={openId}
        onClose={() => setOpenId(null)}
        onReturn={setReturning}
      />
      <SaleReturnDialog sale={returning} onClose={() => setReturning(null)} />
    </div>
  );
}
