"use client";

import { IconReceiptRefund, IconSearch } from "@tabler/icons-react";
import { useState } from "react";

import { Money } from "@/components/shared/Money";
import { Num } from "@/components/shared/Num";
import { OptionSelect } from "@/components/shared/OptionSelect";
import { PageHeader } from "@/components/shared/PageHeader";
import { PeriodPicker } from "@/components/shared/PeriodPicker";
import { StatTile } from "@/components/shared/StatTile";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

import { RETURN_REASON_FILTER_OPTIONS } from "../config/saleOptions";
import {
  useReturnsFilters,
  type ReturnsFilters,
} from "../hooks/useReturnsFilters";
import type { Sale } from "../types/sale";
import { ReturnsTable } from "./returnsTable";
import { SaleDetailSheet } from "./saleDetailSheet";
import { SaleReturnDialog } from "./saleReturnDialog";

function ReturnsStats({ totals }: { totals: ReturnsFilters["totals"] }) {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
      <StatTile
        index={0}
        icon={<IconReceiptRefund />}
        label="مرتجعات الصفحة"
        tone="danger"
      >
        <Money amount={totals.value} className="text-lg" />
      </StatTile>
      <StatTile index={1} icon={<IconReceiptRefund />} label="رُدّ نقداً">
        <Money amount={totals.cash} className="text-lg" />
      </StatTile>
      <StatTile index={2} icon={<IconReceiptRefund />} label="عدد المرتجعات">
        <Num>{totals.count}</Num>
      </StatTile>
    </div>
  );
}

function ReturnsToolbar({ filters: f }: { filters: ReturnsFilters }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <InputGroup className="h-10 min-w-56 flex-1">
        <InputGroupAddon>
          <IconSearch />
        </InputGroupAddon>
        <InputGroupInput
          data-page-search
          value={f.search}
          onChange={(e) => f.setSearch(e.target.value)}
          placeholder="رقم الفاتورة أو المرتجع أو العميل…  ( / )"
          aria-label="بحث في المرتجعات"
        />
      </InputGroup>
      <PeriodPicker value={f.period} onChange={f.setPeriod} />
      <OptionSelect
        label="السبب"
        items={RETURN_REASON_FILTER_OPTIONS}
        value={f.reason}
        onChange={f.setReason}
        className="w-36"
      />
    </div>
  );
}

/** سجل المرتجعات: ماذا رجع، من أي فاتورة، ولماذا، وكيف رُدّ المبلغ. */
export function ReturnsScreen() {
  const filters = useReturnsFilters();
  const [openSale, setOpenSale] = useState<string | null>(null);
  const [returning, setReturning] = useState<Sale | null>(null);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <PageHeader
        title="المرتجعات"
        description="المرتجع يرجّع الأصناف للمخزون تلقائياً. لعمل مرتجع جديد افتح الفاتورة من صفحة الفواتير أو من الكاشير (F10)."
      />

      <ReturnsStats totals={filters.totals} />
      <ReturnsToolbar filters={filters} />
      <ReturnsTable filters={filters} onOpenSale={setOpenSale} />

      <SaleDetailSheet
        saleId={openSale}
        onClose={() => setOpenSale(null)}
        onReturn={setReturning}
      />
      <SaleReturnDialog sale={returning} onClose={() => setReturning(null)} />
    </div>
  );
}
