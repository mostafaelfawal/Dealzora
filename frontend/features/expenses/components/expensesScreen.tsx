"use client";

import { IconPlus } from "@tabler/icons-react";
import { useState } from "react";

import type { AppTableBulkActions } from "@/components/shared/AppTable/types";
import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";
import { useHotkey } from "@/hooks/useHotkey";
import { extractErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

import { EXPENSES_SEARCH_ID, PAGE_SIZES } from "../config/expenseOptions";
import { EXPENSES_SHORTCUTS } from "../config/expenseShortcuts";
import { useBulkDeleteExpenses } from "../hooks/useExpenseMutations";
import { useExpensesList } from "../hooks/useExpensesList";
import { useExpensesView } from "../hooks/useExpensesView";
import type { Expense } from "../types/expense";
import { DeleteExpenseDialog } from "./deleteExpenseDialog";
import { ExpenseCard } from "./expenseCard";
import { ExpenseFormDialog } from "./expenseFormDialog";
import { ExpensesEmpty } from "./expensesEmpty";
import { ExpensesPagination } from "./expensesPagination";
import { ExpensesStats } from "./expensesStats";
import { ExpensesTable } from "./expensesTable";
import { ExpensesToolbar } from "./expensesToolbar";

/** نافذة واحدة مفتوحة في كل مرة: فلا تتراكم النوافذ فوق بعضها. */
type DialogState =
  { type: "form"; id: string | null } | { type: "delete"; id: string } | null;

/** صفحة المصاريف: إحصائيات الفترات + بحث وفلاتر + بطاقات أو جدول. */
export function ExpensesScreen() {
  const list = useExpensesList();
  const { view, setView } = useExpensesView();
  const [dialog, setDialog] = useState<DialogState>(null);
  const bulkDelete = useBulkDeleteExpenses();

  const openNew = () => setDialog({ type: "form", id: null });
  const close = () => setDialog(null);
  const target =
    dialog && dialog.id
      ? (list.expenses.find((e) => e.id === dialog.id) ?? null)
      : null;

  const bulkActions: AppTableBulkActions<Expense> = {
    itemLabel: "مصروف",
    isPending: bulkDelete.isPending,
    onDelete: (rows, clear) =>
      bulkDelete.mutate(
        rows.map((e) => ({ id: e.id, version: e.version })),
        { onSuccess: clear },
      ),
    // لو النوع AppTableBulkActions يطلب onDeactivate اجعله optional في types.
  };

  // الاختصارات لا تعمل والنافذة مفتوحة.
  const whenIdle = (fn: () => void) => () => {
    if (dialog === null) fn();
  };

  useHotkey(
    EXPENSES_SHORTCUTS.focusSearch.match,
    whenIdle(() => {
      const input = document.getElementById(
        EXPENSES_SEARCH_ID,
      ) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    }),
  );
  useHotkey(EXPENSES_SHORTCUTS.newExpense.match, whenIdle(openNew));
  useHotkey(
    EXPENSES_SHORTCUTS.toggleView.match,
    whenIdle(() => setView(view === "cards" ? "table" : "cards")),
  );

  const actions = {
    onEdit: (id: string) => setDialog({ type: "form", id }),
    onRemove: (id: string) => setDialog({ type: "delete", id }),
  };

  const emptyAction = (
    <Button size="lg" onClick={openNew} className="gap-2">
      <IconPlus />
      تسجيل أول مصروف
      <ShortcutBadge className="border-primary-foreground/30 text-primary-foreground/80">
        {EXPENSES_SHORTCUTS.newExpense.label}
      </ShortcutBadge>
    </Button>
  );

  function renderBody() {
    // الجدول يعرض التحميل والخطأ والفراغ بنفسه.
    if (view === "table") {
      return (
        <ExpensesTable
          expenses={list.expenses}
          isLoading={list.isPending}
          isFetching={list.isFetching}
          isError={list.isError}
          errorMessage={extractErrorMessage(list.error, "تعذّر تحميل المصاريف")}
          onRetry={() => list.refetch()}
          isFiltered={list.filtered}
          onClearFilters={list.clearFilters}
          emptyAction={emptyAction}
          pagination={{
            total: list.total,
            page: list.page,
            pageSize: list.filters.pageSize,
            onPageChange: (page) => list.patchFilters({ page }),
            onPageSizeChange: (pageSize) => list.patchFilters({ pageSize }),
            pageSizes: PAGE_SIZES,
            itemsLabel: "المصاريف",
          }}
          bulkActions={bulkActions}
          {...actions}
        />
      );
    }

    if (list.isPending) {
      return (
        <p className="border border-dashed py-16 text-center text-sm text-muted-foreground">
          جارٍ تحميل المصاريف…
        </p>
      );
    }

    if (list.isError) {
      return (
        <div className="flex flex-col items-center gap-3 border border-dashed py-16 text-center">
          <p role="alert" className="text-sm text-destructive">
            {extractErrorMessage(list.error, "تعذّر تحميل المصاريف")}
          </p>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => list.refetch()}
          >
            إعادة المحاولة
          </Button>
        </div>
      );
    }

    if (list.expenses.length === 0) {
      return (
        <ExpensesEmpty
          hasExpenses={list.summary.count > 0}
          onClearFilters={list.clearFilters}
          onAdd={openNew}
        />
      );
    }

    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {list.expenses.map((expense, index) => (
          <ExpenseCard
            key={expense.id}
            expense={expense}
            index={index}
            {...actions}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold">المصاريف</h1>
          <p className="text-xs text-muted-foreground">
            سجّل مصاريف المحل وتابعها حسب النوع والفترة.
          </p>
        </div>
        <Button size="lg" onClick={openNew} className="h-10 gap-2">
          <IconPlus className="size-4" />
          مصروف جديد
          <ShortcutBadge className="hidden border-primary-foreground/30 text-primary-foreground/80 lg:inline-flex">
            {EXPENSES_SHORTCUTS.newExpense.label}
          </ShortcutBadge>
        </Button>
      </header>

      <ExpensesStats
        summary={list.summary}
        period={list.filters.period}
        onPeriodChange={(period) => list.patchFilters({ period })}
      />

      <ExpensesToolbar
        filters={list.filters}
        onChange={list.patchFilters}
        view={view}
        onViewChange={setView}
      />

      <p aria-live="polite" className="text-xs text-muted-foreground">
        عرض{" "}
        <bdi dir="ltr" className="font-mono">
          {list.expenses.length}
        </bdi>{" "}
        من{" "}
        <bdi dir="ltr" className="font-mono">
          {list.total}
        </bdi>{" "}
        مصروف
        {list.filtered && (
          <Button
            type="button"
            variant="link"
            size="xs"
            onClick={list.clearFilters}
            className="font-normal"
          >
            مسح الفلاتر
          </Button>
        )}
      </p>

      <div
        aria-busy={list.isFetching}
        className={cn(
          "transition-opacity",
          list.isFetching && !list.isPending && "opacity-60",
        )}
      >
        {renderBody()}
      </div>

      {view === "cards" && list.total > 0 && (
        <ExpensesPagination
          total={list.total}
          page={list.page}
          pageSize={list.filters.pageSize}
          onPageChange={(page) => list.patchFilters({ page })}
          onPageSizeChange={(pageSize) => list.patchFilters({ pageSize })}
        />
      )}

      <ExpenseFormDialog
        open={dialog?.type === "form"}
        expense={dialog?.type === "form" ? target : null}
        onClose={close}
      />
      <DeleteExpenseDialog
        expense={dialog?.type === "delete" ? target : null}
        onClose={close}
      />
    </div>
  );
}
