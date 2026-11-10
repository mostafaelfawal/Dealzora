"use client";

import { IconSearch } from "@tabler/icons-react";

import {
  PeriodPicker,
  type PeriodValue,
} from "@/components/shared/PeriodPicker";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

import { PURCHASE_STATUS_TABS } from "../config/purchaseOptions";
import type { PurchaseStatusFilter } from "../types/purchase";

export function PurchasesToolbar({
  search,
  onSearchChange,
  period,
  onPeriodChange,
  status,
  onStatusChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  period: PeriodValue;
  onPeriodChange: (value: PeriodValue) => void;
  status: PurchaseStatusFilter;
  onStatusChange: (value: PurchaseStatusFilter) => void;
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
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="رقم الفاتورة أو اسم المورد…  ( / )"
            aria-label="بحث في المشتريات"
          />
        </InputGroup>
        <PeriodPicker value={period} onChange={onPeriodChange} />
      </div>
      <SegmentedTabs
        label="حالة الفاتورة"
        items={PURCHASE_STATUS_TABS}
        value={status}
        onChange={onStatusChange}
      />
    </div>
  );
}
