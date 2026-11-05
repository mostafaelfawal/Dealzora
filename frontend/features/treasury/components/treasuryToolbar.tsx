"use client";

import { IconLayoutGrid, IconList } from "@tabler/icons-react";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import {
  DIRECTION_OPTIONS,
  KIND_OPTIONS,
  PERIOD_OPTIONS,
  SORT_OPTIONS,
} from "../config/treasuryOptions";
import { TREASURY_SHORTCUTS } from "../config/treasuryShortcuts";
import type {
  TreasuryFilters,
  TreasuryKindFilter,
  TreasuryPeriod,
  TreasurySortKey,
  TreasuryView,
} from "../types/treasury";

function OptionSelect<T extends string>({
  label,
  items,
  value,
  onChange,
  className,
}: {
  label: string;
  items: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as T);
      }}
    >
      <SelectTrigger
        aria-label={label}
        className={cn("data-[size=default]:h-10", className)}
      >
        <SelectValue className="text-start" />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface TreasuryToolbarProps {
  filters: TreasuryFilters;
  onChange: (partial: Partial<TreasuryFilters>) => void;
  view: TreasuryView;
  onViewChange: (view: TreasuryView) => void;
}

export function TreasuryToolbar({
  filters,
  onChange,
  view,
  onViewChange,
}: TreasuryToolbarProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <OptionSelect<TreasuryPeriod>
          label="الفترة"
          items={PERIOD_OPTIONS}
          value={filters.period}
          onChange={(period) => onChange({ period })}
          className="w-40"
        />
        <OptionSelect<TreasuryKindFilter>
          label="نوع الحركة"
          items={KIND_OPTIONS}
          value={filters.kind}
          onChange={(kind) => onChange({ kind })}
          className="w-40"
        />
        <OptionSelect<TreasurySortKey>
          label="ترتيب القائمة"
          items={SORT_OPTIONS}
          value={filters.sort}
          onChange={(sort) => onChange({ sort })}
          className="w-40"
        />

        <div role="group" aria-label="طريقة العرض" className="ms-auto flex">
          <AppTooltip
            message={`بطاقات (${TREASURY_SHORTCUTS.toggleView.label})`}
          >
            <Button
              type="button"
              size="icon-lg"
              variant={view === "cards" ? "default" : "outline"}
              aria-pressed={view === "cards"}
              aria-label="عرض البطاقات"
              onClick={() => onViewChange("cards")}
              className="size-10"
            >
              <IconLayoutGrid className="size-5" />
            </Button>
          </AppTooltip>
          <AppTooltip message={`جدول (${TREASURY_SHORTCUTS.toggleView.label})`}>
            <Button
              type="button"
              size="icon-lg"
              variant={view === "table" ? "default" : "outline"}
              aria-pressed={view === "table"}
              aria-label="عرض الجدول"
              onClick={() => onViewChange("table")}
              className="size-10 border-s-0"
            >
              <IconList className="size-5" />
            </Button>
          </AppTooltip>
        </div>
      </div>

      <div
        role="group"
        aria-label="تصفية الحركات"
        className="no-scrollbar flex gap-1.5 overflow-x-auto"
      >
        {DIRECTION_OPTIONS.map((option) => (
          <Button
            key={option.id}
            type="button"
            size="sm"
            variant={filters.direction === option.id ? "default" : "outline"}
            aria-pressed={filters.direction === option.id}
            onClick={() => onChange({ direction: option.id })}
            className="shrink-0 font-normal"
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
