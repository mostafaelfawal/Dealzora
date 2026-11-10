"use client";

import { IconPlus } from "@tabler/icons-react";
import { useState } from "react";

import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";
import { useHotkey } from "@/hooks/useHotkey";
import { extractErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

import { PAGE_SIZES } from "../config/treasuryOptions";
import { TREASURY_SHORTCUTS } from "../config/treasuryShortcuts";
import { useTreasuryList } from "../hooks/useTreasuryList";
import { useTreasuryView } from "../hooks/useTreasuryView";
import { DeleteEntryDialog } from "./deleteEntryDialog";
import { ManualEntryDialog } from "./manualEntryDialog";
import { TreasuryEmpty } from "./treasuryEmpty";
import { TreasuryEntryCard } from "./treasuryEntryCard";
import { TreasuryPagination } from "./treasuryPagination";
import { TreasuryStats } from "./treasuryStats";
import { TreasuryTable } from "./treasuryTable";
import { TreasuryToolbar } from "./treasuryToolbar";

/** نافذة واحدة مفتوحة في كل مرة: فلا تتراكم النوافذ فوق بعضها. */
type DialogState =
  | { type: "form"; direction: "in" | "out" }
  | { type: "delete"; id: string }
  | null;

/** صفحة الخزنة: رصيد وإحصائيات سريعة + فلاتر + جدول أو بطاقات + إيداع/سحب يدوي. */
export function TreasuryScreen() {
  const list = useTreasuryList();
  const { view, setView } = useTreasuryView();
  const [dialog, setDialog] = useState<DialogState>(null);

  const close = () => setDialog(null);
  const openForm = () => setDialog({ type: "form", direction: "in" });
  const target =
    dialog?.type === "delete"
      ? (list.entries.find((e) => e.id === dialog.id) ?? null)
      : null;

  // الاختصارات لا تعمل والنافذة مفتوحة.
  const whenIdle = (fn: () => void) => () => {
    if (dialog === null) fn();
  };

  useHotkey(TREASURY_SHORTCUTS.newEntry.match, whenIdle(openForm));
  useHotkey(
    TREASURY_SHORTCUTS.toggleView.match,
    whenIdle(() => setView(view === "cards" ? "table" : "cards")),
  );

  const actions = {
    onRemove: (id: string) => setDialog({ type: "delete", id }),
  };

  const emptyAction = (
    <Button size="lg" onClick={openForm} className="gap-2">
      <IconPlus />
      إضافة رصيد افتتاحي
    </Button>
  );

  function renderBody() {
    if (view === "table") {
      return (
        <TreasuryTable
          entries={list.entries}
          isLoading={list.isPending}
          isFetching={list.isFetching}
          isError={list.isError}
          errorMessage={extractErrorMessage(list.error, "تعذّر تحميل الخزنة")}
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
            pageSizes: [...PAGE_SIZES],
            itemsLabel: "الحركات",
          }}
          {...actions}
        />
      );
    }

    if (list.isPending) {
      return (
        <p className="border border-dashed py-16 text-center text-sm text-muted-foreground">
          جارٍ تحميل الخزنة…
        </p>
      );
    }

    if (list.isError) {
      return (
        <div className="flex flex-col items-center gap-3 border border-dashed py-16 text-center">
          <p role="alert" className="text-sm text-destructive">
            {extractErrorMessage(list.error, "تعذّر تحميل الخزنة")}
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

    if (list.entries.length === 0) {
      return (
        <TreasuryEmpty
          filtered={list.filtered}
          onClearFilters={list.clearFilters}
          onAdd={openForm}
        />
      );
    }

    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {list.entries.map((entry, index) => (
          <TreasuryEntryCard
            key={entry.id}
            entry={entry}
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
          <h1 className="text-lg font-bold">الخزنة</h1>
          <p className="text-xs text-muted-foreground">
            تابع رصيد الخزنة وكل ما دخلها وخرج منها. المبيعات والمشتريات
            والمصروفات والتحصيل تُسجَّل هنا تلقائياً.
          </p>
        </div>
        <Button size="lg" onClick={openForm} className="h-10 gap-2">
          <IconPlus className="size-4" />
          حركة جديدة
          <ShortcutBadge className="hidden border-primary-foreground/30 text-primary-foreground/80 lg:inline-flex">
            {TREASURY_SHORTCUTS.newEntry.label}
          </ShortcutBadge>
        </Button>
      </header>

      <TreasuryStats
        summary={list.summary}
        filters={list.filters}
        onChange={list.patchFilters}
      />

      <TreasuryToolbar
        filters={list.filters}
        onChange={list.patchFilters}
        view={view}
        onViewChange={setView}
      />

      <p aria-live="polite" className="text-xs text-muted-foreground">
        عرض{" "}
        <bdi dir="ltr" className="font-mono">
          {list.entries.length}
        </bdi>{" "}
        من{" "}
        <bdi dir="ltr" className="font-mono">
          {list.total}
        </bdi>{" "}
        حركة
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
        <TreasuryPagination
          total={list.total}
          page={list.page}
          pageSize={list.filters.pageSize}
          onPageChange={(page) => list.patchFilters({ page })}
          onPageSizeChange={(pageSize) => list.patchFilters({ pageSize })}
        />
      )}

      <ManualEntryDialog
        open={dialog?.type === "form"}
        direction={dialog?.type === "form" ? dialog.direction : "in"}
        balance={list.summary.balance}
        onClose={close}
      />
      <DeleteEntryDialog entry={target} onClose={close} />
    </div>
  );
}
