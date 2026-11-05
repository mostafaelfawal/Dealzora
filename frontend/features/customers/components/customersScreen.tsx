"use client";

import { IconPlus } from "@tabler/icons-react";
import { useState } from "react";

import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";
import { useHotkey } from "@/hooks/useHotkey";
import { extractErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

import { CUSTOMERS_SEARCH_ID } from "../config/customerOptions";
import { CUSTOMERS_SHORTCUTS } from "../config/customerShortcuts";
import { useToggleCustomer } from "../hooks/useCustomerMutations";
import { useCustomersList } from "../hooks/useCustomersList";
import { useCustomersView } from "../hooks/useCustomersView";
import { CollectPaymentDialog } from "./collectPaymentDialog";
import { CustomerCard } from "./customerCard";
import { CustomerFormDialog } from "./customerFormDialog";
import { CustomerStatementDialog } from "./customerStatementDialog";
import { CustomersEmpty } from "./customersEmpty";
import { CustomersPagination } from "./customersPagination";
import { CustomersStats } from "./customersStats";
import { CustomersTable } from "./customersTable";
import { CustomersToolbar } from "./customersToolbar";
import { DeleteCustomerDialog } from "./deleteCustomerDialog";

/** نافذة واحدة مفتوحة في كل مرة: فلا تتراكم النوافذ فوق بعضها. */
type DialogState =
  | { type: "form"; id: string | null }
  | { type: "statement" | "collect" | "delete"; id: string }
  | null;

/** صفحة إدارة العملاء: إحصائيات سريعة + بحث وفلاتر + بطاقات أو جدول + كشف حساب وتحصيل. */
export function CustomersScreen() {
  const list = useCustomersList();
  const { view, setView } = useCustomersView();
  const toggle = useToggleCustomer();
  const [dialog, setDialog] = useState<DialogState>(null);

  const close = () => setDialog(null);
  const target =
    dialog && dialog.id
      ? (list.all.find((c) => c.id === dialog.id) ?? null)
      : null;

  // الاختصارات لا تعمل والنافذة مفتوحة.
  const whenIdle = (fn: () => void) => () => {
    if (dialog === null) fn();
  };

  useHotkey(
    CUSTOMERS_SHORTCUTS.focusSearch.match,
    whenIdle(() => {
      const input = document.getElementById(
        CUSTOMERS_SEARCH_ID,
      ) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    }),
  );
  useHotkey(
    CUSTOMERS_SHORTCUTS.newCustomer.match,
    whenIdle(() => setDialog({ type: "form", id: null })),
  );
  useHotkey(
    CUSTOMERS_SHORTCUTS.toggleView.match,
    whenIdle(() => setView(view === "cards" ? "table" : "cards")),
  );

  const actions = {
    onEdit: (id: string) => setDialog({ type: "form", id }),
    onStatement: (id: string) => setDialog({ type: "statement", id }),
    onCollect: (id: string) => setDialog({ type: "collect", id }),
    onToggleActive: (id: string) => {
      const customer = list.all.find((c) => c.id === id);
      if (customer) toggle.mutate({ id, version: customer.version });
    },
    onRemove: (id: string) => setDialog({ type: "delete", id }),
  };

  function renderBody() {
    if (list.isPending) {
      return (
        <p className="border border-dashed py-16 text-center text-sm text-muted-foreground">
          جارٍ تحميل العملاء…
        </p>
      );
    }

    if (list.isError) {
      return (
        <div className="flex flex-col items-center gap-3 border border-dashed py-16 text-center">
          <p role="alert" className="text-sm text-destructive">
            {extractErrorMessage(list.error, "تعذّر تحميل العملاء")}
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

    if (list.customers.length === 0) {
      return (
        <CustomersEmpty
          hasCustomers={list.summary.total > 0}
          onClearFilters={list.clearFilters}
          onAdd={() => setDialog({ type: "form", id: null })}
        />
      );
    }

    return view === "cards" ? (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {list.customers.map((customer, index) => (
          <CustomerCard
            key={customer.id}
            customer={customer}
            index={index}
            {...actions}
          />
        ))}
      </div>
    ) : (
      <CustomersTable customers={list.customers} {...actions} />
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold">العملاء</h1>
          <p className="text-xs text-muted-foreground">
            تابع مديونيات عملائك وحدودهم الائتمانية وحصّل دفعاتهم من مكان واحد.
          </p>
        </div>
        <Button
          size="lg"
          onClick={() => setDialog({ type: "form", id: null })}
          className="h-10 gap-2"
        >
          <IconPlus className="size-4" />
          عميل جديد
          <ShortcutBadge className="hidden border-primary-foreground/30 text-primary-foreground/80 lg:inline-flex">
            {CUSTOMERS_SHORTCUTS.newCustomer.label}
          </ShortcutBadge>
        </Button>
      </header>

      <CustomersStats
        summary={list.summary}
        filter={list.filters.filter}
        onFilterChange={(filter) => list.patchFilters({ filter })}
      />

      <CustomersToolbar
        filters={list.filters}
        summary={list.summary}
        onChange={list.patchFilters}
        view={view}
        onViewChange={setView}
      />

      <p aria-live="polite" className="text-xs text-muted-foreground">
        عرض{" "}
        <bdi dir="ltr" className="font-mono">
          {list.customers.length}
        </bdi>{" "}
        من{" "}
        <bdi dir="ltr" className="font-mono">
          {list.total}
        </bdi>{" "}
        عميل
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

      {list.total > 0 && (
        <CustomersPagination
          total={list.total}
          page={list.page}
          pageSize={list.filters.pageSize}
          onPageChange={(page) => list.patchFilters({ page })}
          onPageSizeChange={(pageSize) => list.patchFilters({ pageSize })}
        />
      )}

      <CustomerFormDialog
        open={dialog?.type === "form"}
        customer={dialog?.type === "form" ? target : null}
        onClose={close}
      />
      <CustomerStatementDialog
        customer={dialog?.type === "statement" ? target : null}
        onClose={close}
        onCollect={actions.onCollect}
        onEdit={actions.onEdit}
      />
      <CollectPaymentDialog
        customer={dialog?.type === "collect" ? target : null}
        onClose={close}
      />
      <DeleteCustomerDialog
        customer={dialog?.type === "delete" ? target : null}
        onClose={close}
        onCollect={actions.onCollect}
      />
    </div>
  );
}
