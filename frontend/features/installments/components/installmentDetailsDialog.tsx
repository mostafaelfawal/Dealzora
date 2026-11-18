"use client";

import { IconBan, IconCash } from "@tabler/icons-react";
import { useState } from "react";

import { Money } from "@/components/shared/Money";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/dates";
import { extractErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

import { useCancelPlan, usePlan } from "../hooks/useInstallments";
import {
  DUE_INFO,
  FREQUENCY_LABEL,
  isoDate,
  planBadge,
} from "../lib/installmentText";
import type { InstallmentPlan } from "../types/installment";

const th = "h-8 px-2.5 text-start text-xs font-normal text-muted-foreground";

function Stat({
  label,
  amount,
  className,
}: {
  label: string;
  amount: number;
  className?: string;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>
        <Money amount={amount} className={cn("text-base", className)} />
      </dd>
    </div>
  );
}

/** تفاصيل الخطة: الأرقام، وجدول الأقساط بحالة كل قسط، والدفعات، والتحصيل والإلغاء. */
export function InstallmentDetailsDialog({
  planId,
  onClose,
  onPay,
}: {
  planId: string | null;
  onClose: () => void;
  onPay: (plan: InstallmentPlan) => void;
}) {
  const query = usePlan(planId);
  const cancel = useCancelPlan();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const plan = query.data;
  const badge = plan ? planBadge(plan) : null;

  return (
    <Dialog
      open={planId !== null}
      onOpenChange={(next) => {
        if (!next) {
          setConfirmCancel(false);
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[92dvh] gap-4 overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="text-start">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {plan?.title ?? "خطة التقسيط"}
            {badge && (
              <span
                className={cn(
                  "px-1.5 py-0.5 text-[11px] font-normal",
                  badge.className,
                )}
              >
                {badge.label}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {plan
              ? `${plan.customerName} · ${plan.installmentsCount} قسط ${FREQUENCY_LABEL[plan.frequency]} من ${isoDate(plan.startDate)} إلى ${isoDate(plan.endDate)}`
              : "جارٍ التحميل…"}
          </DialogDescription>
        </DialogHeader>

        {query.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : query.isError || !plan ? (
          <p role="alert" className="py-8 text-center text-xs text-destructive">
            {extractErrorMessage(query.error, "تعذّر تحميل الخطة")}
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 border bg-muted/40 p-4 text-xs sm:grid-cols-4">
              <Stat label="إجمالي الأقساط" amount={plan.total} />
              <Stat
                label="المحصّل"
                amount={plan.paidAmount}
                className="text-success"
              />
              <Stat label="المتبقي" amount={plan.remaining} />
              <Stat
                label="المتأخر"
                amount={plan.overdueAmount}
                className={
                  plan.overdueAmount > 0 ? "text-destructive" : undefined
                }
              />
              <p className="col-span-full flex flex-wrap gap-x-4 gap-y-1 border-t pt-2 text-muted-foreground">
                <span>
                  الأصل{" "}
                  <Money amount={plan.principal} className="text-foreground" />
                </span>
                {plan.downPayment > 0 && (
                  <span>
                    مقدّم{" "}
                    <Money
                      amount={plan.downPayment}
                      className="text-foreground"
                    />
                  </span>
                )}
                {plan.settledOutside > 0 && (
                  <span>
                    سُدّد من خارج التقسيط (تحصيل أو مرتجع){" "}
                    <Money
                      amount={plan.settledOutside}
                      className="text-foreground"
                    />
                  </span>
                )}
                {plan.note && <span>ملاحظة: {plan.note}</span>}
              </p>
            </dl>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">
                جدول الأقساط{" "}
                <span className="font-normal text-muted-foreground">
                  ({plan.paidCount} من {plan.installmentsCount} مدفوع)
                </span>
              </h3>
              <div className="max-h-72 overflow-y-auto border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
                    <tr className="border-b">
                      <th scope="col" className={th}>
                        #
                      </th>
                      <th scope="col" className={th}>
                        الموعد
                      </th>
                      <th scope="col" className={th}>
                        القسط
                      </th>
                      <th scope="col" className={th}>
                        المدفوع
                      </th>
                      <th scope="col" className={th}>
                        الحالة
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.schedule.map((row) => {
                      const info = DUE_INFO[row.status];
                      return (
                        <tr
                          key={row.seq}
                          className="h-10 border-b last:border-b-0"
                        >
                          <td className="px-2.5 font-mono text-muted-foreground">
                            {row.seq}
                          </td>
                          <td className="px-2.5 whitespace-nowrap">
                            {isoDate(row.dueDate)}
                          </td>
                          <td className="px-2.5">
                            <Money amount={row.amount} className="text-xs" />
                          </td>
                          <td className="px-2.5">
                            {row.paid > 0 ? (
                              <Money
                                amount={row.paid}
                                className="text-xs text-success"
                              />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-2.5">
                            <span
                              className={cn(
                                "px-1.5 py-0.5 text-[11px]",
                                info.className,
                              )}
                            >
                              {info.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {plan.payments.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">الدفعات المحصّلة</h3>
                <ul className="max-h-40 divide-y overflow-y-auto border text-xs">
                  {plan.payments.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 px-2.5 py-2"
                    >
                      <span className="text-muted-foreground">
                        {formatDateTime(p.createdAt)}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{p.note}</span>
                      <Money
                        amount={p.amount}
                        className="text-xs text-success"
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {plan.status === "active" && (
              <div className="flex flex-col-reverse gap-2 border-t pt-3 sm:flex-row sm:items-center">
                {confirmCancel ? (
                  <div className="flex flex-1 flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted-foreground">
                      يتوقف الجدول، ويبقى المتبقي ديناً عادياً على العميل.
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={cancel.isPending}
                      onClick={() =>
                        cancel.mutate(plan, {
                          onSuccess: () => setConfirmCancel(false),
                        })
                      }
                    >
                      تأكيد الإلغاء
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmCancel(false)}
                    >
                      رجوع
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    className="gap-1.5 text-destructive sm:me-auto"
                    onClick={() => setConfirmCancel(true)}
                  >
                    <IconBan className="size-4" />
                    إلغاء الخطة
                  </Button>
                )}
                <Button
                  type="button"
                  size="lg"
                  className="gap-2"
                  onClick={() => onPay(plan)}
                >
                  <IconCash className="size-4" />
                  تحصيل قسط
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
