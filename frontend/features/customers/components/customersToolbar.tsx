"use client";

import {
  IconLayoutGrid,
  IconList,
  IconSearch,
  IconX,
} from "@tabler/icons-react";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  CUSTOMERS_SEARCH_ID,
  FILTER_OPTIONS,
  SORT_OPTIONS,
} from "../config/customerOptions";
import { CUSTOMERS_SHORTCUTS } from "../config/customerShortcuts";
import type {
  CustomerFilter,
  CustomerFilters,
  CustomerSortKey,
  CustomersSummary,
  CustomersView,
} from "../types/customer";

interface CustomersToolbarProps {
  filters: CustomerFilters;
  summary: CustomersSummary;
  onChange: (partial: Partial<CustomerFilters>) => void;
  view: CustomersView;
  onViewChange: (view: CustomersView) => void;
}

/** عدد كل فلتر يظهر بجانبه، فيعرف المدير قبل الضغط ما سيجده. */
function countFor(filter: CustomerFilter, s: CustomersSummary) {
  switch (filter) {
    case "all":
      return s.total;
    case "debtors":
      return s.debtors;
    case "overdue":
      return s.overdue;
    case "limit":
      return s.atLimit;
    case "inactive":
      return s.inactive;
  }
}

export function CustomersToolbar({
  filters,
  summary,
  onChange,
  view,
  onViewChange,
}: CustomersToolbarProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="h-10 min-w-56 flex-1">
          <InputGroupAddon>
            <IconSearch className="mr-2 size-5" />
          </InputGroupAddon>
          <InputGroupInput
            id={CUSTOMERS_SEARCH_ID}
            value={filters.query}
            onChange={(event) => onChange({ query: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Escape" && filters.query) {
                event.preventDefault();
                onChange({ query: "" });
              }
            }}
            aria-label="بحث في العملاء"
            placeholder="ابحث بالاسم أو رقم الهاتف…"
            autoComplete="off"
            spellCheck={false}
            className="h-full text-sm md:text-sm"
          />
          <InputGroupAddon align="inline-end">
            {filters.query ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="ml-2"
                aria-label="مسح البحث"
                onClick={() => onChange({ query: "" })}
              >
                <IconX />
              </Button>
            ) : (
              <ShortcutBadge className="ml-2 hidden rounded-none lg:inline-flex">
                {CUSTOMERS_SHORTCUTS.focusSearch.label}
              </ShortcutBadge>
            )}
          </InputGroupAddon>
        </InputGroup>

        <Select
          items={SORT_OPTIONS}
          value={filters.sort}
          onValueChange={(value) => {
            if (value) onChange({ sort: value as CustomerSortKey });
          }}
        >
          <SelectTrigger
            aria-label="ترتيب القائمة"
            className="w-44 data-[size=default]:h-10"
          >
            <SelectValue className="text-start" />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div role="group" aria-label="طريقة العرض" className="flex">
          <AppTooltip
            message={`بطاقات (${CUSTOMERS_SHORTCUTS.toggleView.label})`}
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
          <AppTooltip
            message={`جدول (${CUSTOMERS_SHORTCUTS.toggleView.label})`}
          >
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
        aria-label="تصفية العملاء"
        className="no-scrollbar flex gap-1.5 overflow-x-auto"
      >
        {FILTER_OPTIONS.map((option) => (
          <Button
            key={option.id}
            type="button"
            size="sm"
            variant={filters.filter === option.id ? "default" : "outline"}
            aria-pressed={filters.filter === option.id}
            onClick={() => onChange({ filter: option.id })}
            className="shrink-0 gap-1.5 font-normal"
          >
            {option.label}
            <bdi
              dir="ltr"
              className="font-mono text-[11px] tabular-nums opacity-70"
            >
              {countFor(option.id, summary)}
            </bdi>
          </Button>
        ))}
      </div>
    </div>
  );
}
