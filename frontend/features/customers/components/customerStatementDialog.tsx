"use client";

import { IconCash, IconPhone } from "@tabler/icons-react";

import { Money } from "@/components/shared/Money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { extractErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

import useGetStatement from "../hooks/useGetStatement";
import { formatDate, formatDaysAgo, initialOf } from "../lib/customerCalc";
import type { Customer, StatementEntryType } from "../types/customer";
import { CustomerCreditMeter } from "./customerCreditMeter";
import { CustomerStatusBadges } from "./customerStatusBadges";

const TYPE_LABEL: Record<StatementEntryType, string> = {
  sale: "فاتورة بيع",
  payment: "دفعة",
  return: "مرتجع",
  opening: "رصيد افتتاحي",
  adjustment: "تعديل يدوي",
};

const th = "h-8 px-2.5 text-start text-xs font-normal text-muted-foreground";

/** كشف حساب العميل: الحالة المالية أعلى، والحركات من الأحدث للأقدم. */
export function CustomerStatementDialog({
  customer,
  onClose,
  onCollect,
  onEdit,
}: {
  customer: Customer | null;
  onClose: () => void;
  onCollect: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  return (
    <Dialog open={customer !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[90dvh] gap-3 overflow-y-auto sm:max-w-2xl"
      >
        {customer && (
          <Statement
            customer={customer}
            onClose={onClose}
            onCollect={onCollect}
            onEdit={onEdit}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Statement({
  customer,
  onClose,
  onCollect,
  onEdit,
}: {
  customer: Customer;
  onClose: () => void;
  onCollect: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  const { data, isPending, isError, error, refetch } = useGetStatement(customer.id);
  const entries = data ? [...data].reverse() : [];
  const hasDebt = customer.balance > 0;

  return (
    <>
      <DialogHeader className="text-start">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center bg-muted text-base font-medium text-muted-foreground"
          >
            {initialOf(customer.name)}
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <DialogTitle className="truncate">{customer.name}</DialogTitle>
            <DialogDescription className="flex items-center gap-1.5">
              <IconPhone className="size-3.5 shrink-0" aria-hidden />
              <span dir="ltr" className="font-mono">
                {customer.phone || "بدون رقم"}
              </span>
            </DialogDescription>
            <div className="flex flex-wrap gap-1.5 empty:hidden">
              <CustomerStatusBadges customer={customer} />
            </div>
          </div>
        </div>
      </DialogHeader>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="space-y-1 border p-3">
          <p className="text-xs text-muted-foreground">المديونية</p>
          {hasDebt ? (
            <Money amount={customer.balance} className="text-2xl leading-none text-destructive" />
          ) : (
            <p className="text-base font-semibold text-success">لا مديونية</p>
          )}
          <p className="text-[11px] text-muted-foreground">
            آخر دفعة: {formatDaysAgo(customer.lastPaymentAt)}
          </p>
        </div>
        <div className="space-y-2 border p-3">
          <p className="text-xs text-muted-foreground">الحد الائتماني</p>
          <CustomerCreditMeter customer={customer} />
        </div>
        <div className="space-y-1 border p-3">
          <p className="text-xs text-muted-foreground">إجمالي مشترياته</p>
          <Money amount={customer.totalSales} className="text-2xl leading-none" />
          <p className="text-[11px] text-muted-foreground">
            آخر شراء: {formatDaysAgo(customer.lastPurchaseAt)}
          </p>
        </div>
      </div>

      {customer.notes && (
        <p className="border-s-2 border-primary/40 ps-2 text-xs text-muted-foreground">
          {customer.notes}
        </p>
      )}

      <div className="max-h-72 overflow-auto border">
        {isPending ? (
          <p className="py-10 text-center text-xs text-muted-foreground">
            جارٍ تحميل كشف الحساب…
          </p>
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p role="alert" className="text-xs text-destructive">
              {extractErrorMessage(error, "تعذّر تحميل كشف الحساب")}
            </p>
            <Button type="button" size="sm" variant="outline" onClick={() => refetch()}>
              إعادة المحاولة
            </Button>
          </div>
        ) : entries.length === 0 ? (
          <div className="space-y-1 py-10 text-center text-xs">
            <p className="text-sm font-medium">لا توجد حركات بعد</p>
            <p className="text-muted-foreground">
              ستظهر هنا فواتيره الآجلة ودفعاته فور حدوثها.
            </p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
              <tr className="border-b">
                <th scope="col" className={th}>
                  التاريخ
                </th>
                <th scope="col" className={th}>
                  البيان
                </th>
                <th scope="col" className={th}>
                  عليه
                </th>
                <th scope="col" className={th}>
                  له
                </th>
                <th scope="col" className={th}>
                  الرصيد
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="h-11 border-b last:border-b-0">
                  <td className="px-2.5 whitespace-nowrap text-muted-foreground">
                    {formatDate(entry.date)}
                  </td>
                  <td className="px-2.5">
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-normal",
                        entry.credit > 0 && "border-success/50 text-success",
                      )}
                    >
                      {TYPE_LABEL[entry.type]}
                    </Badge>
                    <span className="ms-1.5 text-[11px] text-muted-foreground">
                      {entry.ref}
                    </span>
                  </td>
                  <td className="px-2.5">
                    {entry.debit > 0 ? <Money amount={entry.debit} className="text-xs" /> : "—"}
                  </td>
                  <td className="px-2.5">
                    {entry.credit > 0 ? (
                      <Money amount={entry.credit} className="text-xs text-success" />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-2.5">
                    <Money amount={entry.balance} className="text-xs font-medium" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" size="lg" onClick={onClose} className="font-normal sm:me-auto">
          إغلاق
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => onEdit(customer.id)}
          className="font-normal"
        >
          تعديل البيانات
        </Button>
        <Button
          type="button"
          size="lg"
          disabled={!hasDebt}
          onClick={() => onCollect(customer.id)}
          className="gap-2"
        >
          <IconCash className="size-4" />
          تحصيل دفعة
        </Button>
      </div>
    </>
  );
}
