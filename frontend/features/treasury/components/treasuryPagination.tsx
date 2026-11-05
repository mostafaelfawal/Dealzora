"use client";

import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { PAGE_SIZES } from "../config/treasuryOptions";

const PAGE_SIZE_ITEMS = PAGE_SIZES.map((size) => ({
  value: String(size),
  label: String(size),
}));

/** أرقام الصفحات مع "…" لو العدد كبير: 1 … 4 5 6 … 20 */
function getPageItems(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const sorted = [...new Set([1, total, current - 1, current, current + 1])]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);

  const items: (number | "gap")[] = [];
  sorted.forEach((page, i) => {
    if (i > 0 && page - sorted[i - 1] > 1) items.push("gap");
    items.push(page);
  });
  return items;
}

interface TreasuryPaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function TreasuryPagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: TreasuryPaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageItems = getPageItems(currentPage, pageCount);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
      <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
        <span aria-live="polite">
          عرض{" "}
          <bdi dir="ltr" className="font-mono text-foreground tabular-nums">
            {total === 0 ? 0 : start + 1}–{end}
          </bdi>{" "}
          من{" "}
          <bdi dir="ltr" className="font-mono tabular-nums">
            {total}
          </bdi>
        </span>

        <div className="flex items-center gap-2">
          <span>عدد الحركات في الصفحة</span>
          <Select
            items={PAGE_SIZE_ITEMS}
            value={String(pageSize)}
            onValueChange={(value) => {
              if (value) onPageSizeChange(Number(value));
            }}
          >
            <SelectTrigger
              aria-label="عدد الحركات في الصفحة"
              className="w-20 data-[size=default]:h-8"
            >
              <SelectValue className="text-start" />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {PAGE_SIZE_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {pageCount > 1 && (
        <nav
          aria-label="التنقل بين الصفحات"
          className="flex items-center gap-1"
        >
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="الصفحة السابقة"
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="size-8"
          >
            {/* RTL: السابق على اليمين */}
            <IconChevronRight />
          </Button>

          {pageItems.map((item, index) =>
            item === "gap" ? (
              <span
                key={`gap-${index}`}
                aria-hidden
                className="px-1 text-muted-foreground"
              >
                …
              </span>
            ) : (
              <Button
                key={item}
                type="button"
                size="sm"
                variant={item === currentPage ? "default" : "outline"}
                aria-label={`الصفحة ${item}`}
                aria-current={item === currentPage ? "page" : undefined}
                onClick={() => onPageChange(item)}
                className="size-8 p-0 font-mono font-normal tabular-nums"
              >
                {item}
              </Button>
            ),
          )}

          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="الصفحة التالية"
            disabled={currentPage === pageCount}
            onClick={() => onPageChange(currentPage + 1)}
            className="size-8"
          >
            {/* RTL: التالي على اليسار */}
            <IconChevronLeft />
          </Button>
        </nav>
      )}
    </div>
  );
}
