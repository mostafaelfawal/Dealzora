"use client";

import { IconSearch } from "@tabler/icons-react";

import { OptionSelect } from "@/components/shared/OptionSelect";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

import {
  INVENTORY_TABS,
  STAGNANT_DAYS_OPTIONS,
} from "../config/inventoryOptions";
import type { InventoryList } from "../hooks/useInventoryList";
import type { InventoryTab, StockReport } from "../types/inventory";

const tabCount = (id: InventoryTab, r: StockReport | undefined) =>
  id === "all" ? undefined : r?.[id].length;

export function InventoryToolbar({ list }: { list: InventoryList }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="h-10 min-w-56 flex-1">
          <InputGroupAddon>
            <IconSearch />
          </InputGroupAddon>
          <InputGroupInput
            data-page-search
            value={list.search}
            onChange={(e) => list.setSearch(e.target.value)}
            placeholder="اسم الصنف أو الباركود…  ( / )"
            aria-label="بحث في المخزون"
          />
        </InputGroup>
        {list.tab === "stagnant" && (
          <OptionSelect
            label="مدة الركود"
            items={STAGNANT_DAYS_OPTIONS}
            value={
              list.stagnantDays as (typeof STAGNANT_DAYS_OPTIONS)[number]["value"]
            }
            onChange={list.setStagnantDays}
            className="w-40"
          />
        )}
      </div>
      <SegmentedTabs
        label="عرض"
        items={INVENTORY_TABS.map((t) => ({
          ...t,
          count: tabCount(t.id, list.report),
        }))}
        value={list.tab}
        onChange={list.setTab}
      />
    </div>
  );
}
