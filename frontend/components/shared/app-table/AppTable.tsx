"use client";

import { IconAlertTriangle, IconFilterOff } from "@tabler/icons-react";
import { useMemo, useState, type ReactNode } from "react";

import { listRow, MotionTr } from "@/components/shared/motion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { AppTableBulkBar } from "./AppTableBulkBar";
import { AppTablePagination } from "./AppTablePagination";
import type {
  AppTableBulkActions,
  AppTableColumn,
  AppTableEmptyState,
  AppTableNoResults,
  AppTablePaginationProps,
} from "./types";

const th = "h-9 px-3 text-start text-xs font-normal text-muted-foreground";
const INTERACTIVE =
  "a, button, input, label, [role='switch'], [role='checkbox'], [role='menu'], [role='menuitem']";

export interface AppTableProps<T> {
  data: T[];
  columns: AppTableColumn<T>[];
  getRowId: (row: T) => string;

  /* الحالات */
  isLoading?: boolean;
  isFetching?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  skeletonRows?: number;

  /* فارغ / لا نتائج */
  empty: AppTableEmptyState;
  noResults?: AppTableNoResults;
  /** true لو فيه بحث أو فلاتر مفعّلة، فتظهر "لا نتائج" بدل "فارغ". */
  isFiltered?: boolean;
  onClearFilters?: () => void;

  /* الصفوف */
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  rowHeightClassName?: string;
  minWidthClassName?: string;

  /* التحديد المتعدد */
  selectable?: boolean;
  isRowSelectable?: (row: T) => boolean;
  /** نص قارئ الشاشة لمربع تحديد الصف، مثل اسم الصنف. */
  getRowLabel?: (row: T) => string;
  bulkActions?: AppTableBulkActions<T>;

  pagination?: AppTablePaginationProps;
}

function StateBox({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border border-dashed py-16 text-center">
      {children}
    </div>
  );
}

export function AppTable<T>({
  data,
  columns,
  getRowId,
  isLoading = false,
  isFetching = false,
  isError = false,
  errorMessage = "تعذّر تحميل البيانات",
  onRetry,
  skeletonRows,
  empty,
  noResults,
  isFiltered = false,
  onClearFilters,
  onRowClick,
  rowClassName,
  rowHeightClassName = "h-14",
  minWidthClassName = "min-w-170",
  selectable = false,
  isRowSelectable,
  getRowLabel,
  bulkActions,
  pagination,
}: AppTableProps<T>) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const selectableRows = useMemo(
    () => (selectable ? data.filter((row) => isRowSelectable?.(row) ?? true) : []),
    [data, selectable, isRowSelectable],
  );
  // نعتمد فقط على الصفوف الظاهرة حالياً، فلا يبقى تحديد لصفوف اختفت.
  const selectedRows = useMemo(
    () => selectableRows.filter((row) => selected.has(getRowId(row))),
    [selectableRows, selected, getRowId],
  );

  const allSelected = selectableRows.length > 0 && selectedRows.length === selectableRows.length;
  const someSelected = selectedRows.length > 0 && !allSelected;

  const clearSelection = () => setSelected(new Set());

  function toggleAll(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const row of selectableRows) {
        if (checked) next.add(getRowId(row));
        else next.delete(getRowId(row));
      }
      return next;
    });
  }

  function toggleRow(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const showEmpty = !isLoading && !isError && data.length === 0;
  const hasBulk = Boolean(bulkActions?.onDelete || bulkActions?.onDeactivate);

  function renderState() {
    if (isError) {
      return (
        <StateBox>
          <IconAlertTriangle className="size-10 text-muted-foreground" />
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
          {onRetry && (
            <Button type="button" variant="outline" size="lg" onClick={onRetry}>
              إعادة المحاولة
            </Button>
          )}
        </StateBox>
      );
    }

    if (isFiltered) {
      const Icon = noResults?.icon ?? IconFilterOff;
      return (
        <StateBox>
          <Icon className="size-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">{noResults?.title ?? "لا توجد نتائج مطابقة"}</p>
            <p className="text-xs text-muted-foreground">
              {noResults?.description ?? "جرّب كلمة أخرى أو امسح الفلاتر."}
            </p>
          </div>
          {onClearFilters && (
            <Button type="button" variant="outline" size="lg" onClick={onClearFilters}>
              مسح الفلاتر
            </Button>
          )}
        </StateBox>
      );
    }

    const Icon = empty.icon;
    return (
      <StateBox>
        <Icon className="size-10 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium">{empty.title}</p>
          {empty.description && (
            <p className="max-w-xs text-xs text-muted-foreground">{empty.description}</p>
          )}
        </div>
        {empty.action && <div className="flex flex-wrap justify-center gap-2">{empty.action}</div>}
      </StateBox>
    );
  }

  const skeletonCount = skeletonRows ?? Math.min(pagination?.pageSize ?? 8, 8);

  return (
    <div className="flex flex-col gap-3">
      {isError || showEmpty ? (
        renderState()
      ) : (
        <div
          aria-busy={isLoading || isFetching}
          className={cn(
            "overflow-x-auto border bg-card transition-opacity",
            isFetching && !isLoading && "opacity-60",
          )}
        >
          <table className={cn("w-full text-xs", minWidthClassName)}>
            <thead className="bg-muted/40">
              <tr className="border-b">
                {selectable && (
                  <th scope="col" className="w-10 px-3">
                    <Checkbox
                      aria-label="تحديد الكل"
                      checked={allSelected}
                      indeterminate={someSelected}
                      disabled={isLoading || selectableRows.length === 0}
                      onCheckedChange={(checked) => toggleAll(Boolean(checked))}
                    />
                  </th>
                )}
                {columns.map((column) => (
                  <th key={column.id} scope="col" className={cn(th, column.className)}>
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {isLoading
                ? Array.from({ length: skeletonCount }, (_, i) => (
                    <tr key={i} className={cn(rowHeightClassName, "border-b last:border-b-0")}>
                      {selectable && (
                        <td className="px-3">
                          <Skeleton className="size-4" />
                        </td>
                      )}
                      {columns.map((column) => (
                        <td key={column.id} className={cn("px-3", column.className)}>
                          <Skeleton className={cn("h-4 w-24", column.skeletonClassName)} />
                        </td>
                      ))}
                    </tr>
                  ))
                : data.map((row, index) => {
                    const id = getRowId(row);
                    const canSelect = selectable && (isRowSelectable?.(row) ?? true);
                    const isSelected = selected.has(id);

                    return (
                      <MotionTr
                        key={id}
                        {...listRow(index)}
                        style={{ animationDelay: `${Math.min(index, 12) * 20}ms` }}
                        data-state={isSelected ? "selected" : undefined}
                        onClick={
                          onRowClick
                            ? (event) => {
                                const target = event.target as HTMLElement;
                                // أحداث الـ portal (القوائم والنوافذ) تصعد في شجرة React رغم أنها خارج الصف.
                                if (!event.currentTarget.contains(target)) return;
                                if (target.closest(INTERACTIVE)) return;
                                onRowClick(row);
                              }
                            : undefined
                        }
                        className={cn(
                          rowHeightClassName,
                          "border-b fill-mode-backwards duration-300 last:border-b-0 hover:bg-muted/50 data-[state=selected]:bg-muted/60",
                          onRowClick && "cursor-pointer",
                          rowClassName?.(row),
                        )}
                      >
                        {selectable && (
                          <td className="w-10 px-3">
                            {canSelect && (
                              <Checkbox
                                aria-label={getRowLabel ? `تحديد ${getRowLabel(row)}` : "تحديد الصف"}
                                checked={isSelected}
                                onCheckedChange={(checked) => toggleRow(id, Boolean(checked))}
                              />
                            )}
                          </td>
                        )}
                        {columns.map((column) => (
                          <td
                            key={column.id}
                            className={cn("px-3", column.className, column.cellClassName)}
                          >
                            {column.cell(row, index)}
                          </td>
                        ))}
                      </MotionTr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.total > 0 && <AppTablePagination {...pagination} />}

      {hasBulk && bulkActions && selectedRows.length > 0 && (
        <AppTableBulkBar rows={selectedRows} actions={bulkActions} onClear={clearSelection} />
      )}
    </div>
  );
}