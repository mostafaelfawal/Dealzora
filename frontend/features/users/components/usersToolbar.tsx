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
  ROLE_FILTERS,
  SORT_OPTIONS,
  STATUS_FILTERS,
  USERS_SEARCH_ID,
} from "../config/userOptions";
import { USERS_SHORTCUTS } from "../config/userShortcuts";
import type { UserFilters, UserSortKey, UsersView } from "../types/user";

interface UsersToolbarProps {
  filters: UserFilters;
  onChange: (partial: Partial<UserFilters>) => void;
  view: UsersView;
  onViewChange: (view: UsersView) => void;
}

export function UsersToolbar({
  filters,
  onChange,
  view,
  onViewChange,
}: UsersToolbarProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="h-10 min-w-56 flex-1">
          <InputGroupAddon>
            <IconSearch className="mr-2 size-5" />
          </InputGroupAddon>
          <InputGroupInput
            data-page-search
            id={USERS_SEARCH_ID}
            value={filters.query}
            onChange={(event) => onChange({ query: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Escape" && filters.query) {
                event.preventDefault();
                onChange({ query: "" });
              }
            }}
            aria-label="بحث في المستخدمين"
            placeholder="ابحث باسم المستخدم…"
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
                {USERS_SHORTCUTS.focusSearch.label}
              </ShortcutBadge>
            )}
          </InputGroupAddon>
        </InputGroup>

        <Select
          items={SORT_OPTIONS}
          value={filters.sort}
          onValueChange={(value) => {
            if (value) onChange({ sort: value as UserSortKey });
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
          <AppTooltip message={`بطاقات (${USERS_SHORTCUTS.toggleView.label})`}>
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
          <AppTooltip message={`جدول (${USERS_SHORTCUTS.toggleView.label})`}>
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

      <div className="no-scrollbar flex gap-x-4 gap-y-2 overflow-x-auto">
        <div role="group" aria-label="الدور" className="flex gap-1.5">
          {ROLE_FILTERS.map((item) => (
            <Button
              key={item.value}
              type="button"
              size="sm"
              variant={filters.role === item.value ? "default" : "outline"}
              aria-pressed={filters.role === item.value}
              onClick={() => onChange({ role: item.value })}
              className="shrink-0 font-normal"
            >
              {item.label}
            </Button>
          ))}
        </div>
        <div role="group" aria-label="الحالة" className="flex gap-1.5">
          {STATUS_FILTERS.map((item) => (
            <Button
              key={item.value}
              type="button"
              size="sm"
              variant={filters.status === item.value ? "default" : "outline"}
              aria-pressed={filters.status === item.value}
              onClick={() => onChange({ status: item.value })}
              className="shrink-0 font-normal"
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
