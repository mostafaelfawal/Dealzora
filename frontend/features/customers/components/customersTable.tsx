"use client";

import { IconCash, IconPhone } from "@tabler/icons-react";

import { Money } from "@/components/shared/Money";
import { listRow, MotionTr } from "@/components/shared/motion";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { formatDaysAgo } from "../lib/customerCalc";
import type { Customer } from "../types/customer";
import {
  CustomerActionsMenu,
  type CustomerActions,
} from "./customerActionsMenu";
import { CustomerCreditMeter } from "./customerCreditMeter";
import { CustomerStatusBadges } from "./customerStatusBadges";

const th = "h-9 px-3 text-start text-xs font-normal text-muted-foreground";

/** جدول العملاء. الضغط على الصف يفتح كشف الحساب، وعناصر التحكم بداخله لا تفعل ذلك. */
export function CustomersTable({
  customers,
  ...actions
}: { customers: Customer[] } & CustomerActions) {
  return (
    <div className="overflow-x-auto border bg-card">
      <table className="w-full min-w-170 text-xs">
        <thead className="bg-muted/40">
          <tr className="border-b">
            <th scope="col" className={th}>
              العميل
            </th>
            <th scope="col" className={th}>
              المديونية
            </th>
            <th scope="col" className={cn(th, "hidden w-48 md:table-cell")}>
              الحد الائتماني
            </th>
            <th scope="col" className={cn(th, "hidden lg:table-cell")}>
              آخر شراء
            </th>
            <th scope="col" className={cn(th, "hidden lg:table-cell")}>
              آخر دفعة
            </th>
            <th scope="col" className={cn(th, "w-20")}>
              مفعّل
            </th>
            <th scope="col" className="w-12">
              <span className="sr-only">إجراءات</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer, index) => (
            <MotionTr
              key={customer.id}
              {...listRow(index)}
              style={{ animationDelay: `${Math.min(index, 12) * 20}ms` }}
              onClick={(event) => {
                const target = event.target as HTMLElement;
                // أحداث الـ portal (القائمة والنوافذ) تصعد في شجرة React رغم أنها خارج الصف في الـ DOM.
                if (!event.currentTarget.contains(target)) return;
                if (
                  target.closest(
                    "a, button, input, label, [role='switch'], [role='menu'], [role='menuitem']",
                  )
                )
                  return;
                actions.onStatement(customer.id);
              }}
              className="h-16 cursor-pointer border-b fill-mode-backwards duration-300 last:border-b-0 hover:bg-muted/50"
            >
              <td
                className={cn(
                  "min-w-0 px-3",
                  !customer.isActive && "opacity-60",
                )}
              >
                <button
                  type="button"
                  onClick={() => actions.onStatement(customer.id)}
                  className="block max-w-56 truncate text-start text-xs font-medium outline-none hover:underline focus-visible:underline"
                >
                  {customer.name}
                </button>
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <IconPhone className="size-3.5" aria-hidden />
                  <span dir="ltr" className="font-mono">
                    {customer.phone || "بدون رقم"}
                  </span>
                </span>
                <span className="mt-1 flex flex-wrap gap-1 empty:hidden">
                  <CustomerStatusBadges customer={customer} />
                </span>
              </td>
              <td className="px-3">
                {customer.balance > 0 ? (
                  <div className="flex items-center gap-2">
                    <Money
                      amount={customer.balance}
                      className="text-sm text-destructive"
                    />
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      aria-label={`تحصيل دفعة من ${customer.name}`}
                      onClick={() => actions.onCollect(customer.id)}
                      className="size-7"
                    >
                      <IconCash />
                    </Button>
                  </div>
                ) : (
                  <span className="text-muted-foreground">لا مديونية</span>
                )}
              </td>
              <td className="hidden px-3 md:table-cell">
                <CustomerCreditMeter customer={customer} />
              </td>
              <td className="hidden px-3 text-muted-foreground lg:table-cell">
                {formatDaysAgo(customer.lastPurchaseAt)}
              </td>
              <td className="hidden px-3 text-muted-foreground lg:table-cell">
                {formatDaysAgo(customer.lastPaymentAt)}
              </td>
              <td className="px-3">
                <Switch
                  size="sm"
                  checked={customer.isActive}
                  onCheckedChange={() => actions.onToggleActive(customer.id)}
                  aria-label={`${customer.isActive ? "تعطيل" : "تفعيل"} ${customer.name}`}
                />
              </td>
              <td className="pe-2">
                <CustomerActionsMenu customer={customer} {...actions} />
              </td>
            </MotionTr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
