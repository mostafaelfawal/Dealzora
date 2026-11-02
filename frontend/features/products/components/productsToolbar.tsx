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

import { SORT_OPTIONS } from "../config/productOptions";
import { PRODUCTS_SHORTCUTS } from "../config/productShortcuts";
import { PRODUCT_CATEGORIES } from "../mocks/productsData";
import type { ProductFilters, ProductsView, SortKey } from "../types/product";
import { PRODUCTS_SEARCH_ID } from "./productsScreen";

interface ProductsToolbarProps {
  filters: ProductFilters;
  onChange: (partial: Partial<ProductFilters>) => void;
  view: ProductsView;
  onViewChange: (view: ProductsView) => void;
}

export function ProductsToolbar({
  filters,
  onChange,
  view,
  onViewChange,
}: ProductsToolbarProps) {
  const categories = [{ id: "all", label: "الكل" }, ...PRODUCT_CATEGORIES];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="h-10 min-w-56 flex-1">
          <InputGroupAddon>
            <IconSearch className="mr-2 size-5" />
          </InputGroupAddon>
          <InputGroupInput
            id={PRODUCTS_SEARCH_ID}
            value={filters.query}
            onChange={(event) => onChange({ query: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Escape" && filters.query) {
                event.preventDefault();
                onChange({ query: "" });
              }
            }}
            aria-label="بحث في المنتجات"
            placeholder="ابحث بالاسم أو الباركود…"
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
                {PRODUCTS_SHORTCUTS.focusSearch.label}
              </ShortcutBadge>
            )}
          </InputGroupAddon>
        </InputGroup>

        <Select
          items={SORT_OPTIONS}
          value={filters.sort}
          onValueChange={(value) => {
            if (value) onChange({ sort: value as SortKey });
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
            message={`بطاقات (${PRODUCTS_SHORTCUTS.toggleView.label})`}
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
          <AppTooltip message={`جدول (${PRODUCTS_SHORTCUTS.toggleView.label})`}>
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
        aria-label="الأقسام"
        className="no-scrollbar flex gap-1.5 overflow-x-auto"
      >
        {categories.map((category) => (
          <Button
            key={category.id}
            type="button"
            size="sm"
            variant={filters.category === category.id ? "default" : "outline"}
            aria-pressed={filters.category === category.id}
            onClick={() => onChange({ category: category.id })}
            className="shrink-0 font-normal"
          >
            {category.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
