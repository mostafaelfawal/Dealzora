"use client";

import { IconSearch } from "@tabler/icons-react";
import type { ReactNode } from "react";

import { OptionSelect } from "@/components/shared/OptionSelect";
import { PeriodPicker } from "@/components/shared/PeriodPicker";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

import {
  METHOD_OPTIONS,
  SORT_OPTIONS,
  STATUS_TABS,
} from "../config/saleOptions";
import type { SalesFilters } from "../hooks/useSalesFilters";

export function SalesToolbar({
  filters: f,
  viewToggle,
}: {
  filters: SalesFilters;
  /** زر البطاقات/الجدول في آخر السطر. */
  viewToggle?: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="h-10 min-w-56 flex-1">
          <InputGroupAddon>
            <IconSearch />
          </InputGroupAddon>
          <InputGroupInput
            data-page-search
            value={f.search}
            onChange={(e) => f.setSearch(e.target.value)}
            placeholder="رقم الفاتورة أو اسم/هاتف العميل…  ( / )"
            aria-label="بحث في الفواتير"
          />
        </InputGroup>
        <PeriodPicker value={f.period} onChange={f.setPeriod} />
        <OptionSelect
          label="طريقة الدفع"
          items={METHOD_OPTIONS}
          value={f.method}
          onChange={f.setMethod}
          className="w-36"
        />
        <OptionSelect
          label="الترتيب"
          items={SORT_OPTIONS}
          value={f.sort}
          onChange={f.setSort}
          className="w-36"
        />
        {viewToggle}
      </div>
      <SegmentedTabs
        label="حالة الفاتورة"
        items={STATUS_TABS}
        value={f.status}
        onChange={f.setStatus}
      />
    </div>
  );
}
