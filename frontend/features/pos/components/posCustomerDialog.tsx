"use client";

import {
  IconCheck,
  IconGift,
  IconPhone,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

import { Money } from "@/components/shared/Money";
import { Badge } from "@/components/ui/badge";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { toArabicDigits } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { cn } from "cn";
import { useLoyaltyConfig } from "@/lib/loyalty";
import { selectCustomer } from "../store/posActions";
import { posUiActions } from "../store/posUiSlice";
import { selectCustomers, selectInvoiceCustomer } from "../store/selectors";
import type { PosCustomer } from "../types/pos";

import {
  PosPickerFooter,
  PosPickerHeader,
  pickerItemClass,
} from "./posPickerChrome";
import { UpgradeNotice } from "@/components/shared/PlanGate";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useFeature } from "@/lib/plan";

function Avatar({
  selected,
  children,
}: {
  selected: boolean;
  children: ReactNode;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center bg-muted text-sm font-medium text-muted-foreground",
        selected && "bg-primary text-primary-foreground",
      )}
    >
      {selected ? <IconCheck className="size-4" /> : children}
    </span>
  );
}

/** حالة العميل المالية: المديونية، والمتاح من الحد الائتماني مع شريط استهلاك. */
function CreditStatus({ customer }: { customer: PosCustomer }) {
  const { balance, creditLimit } = customer;
  const available = Math.max(creditLimit - balance, 0);
  const ratio = creditLimit > 0 ? Math.min(balance / creditLimit, 1) : 1;

  return (
    <span className="flex w-36 shrink-0 flex-col items-end gap-1">
      <span className="flex items-baseline gap-1 text-xs text-muted-foreground">
        {balance > 0 ? (
          <>
            دين <Money amount={balance} className="text-foreground" />
          </>
        ) : (
          "بدون مديونية"
        )}
      </span>

      {creditLimit === 0 ? (
        <Badge variant="outline" className="font-normal text-muted-foreground">
          نقدي فقط
        </Badge>
      ) : (
        <>
          {available === 0 ? (
            <span className="text-[11px] text-destructive">
              بلغ الحد الائتماني
            </span>
          ) : (
            <span className="flex items-baseline gap-1 text-[11px] text-muted-foreground">
              المتاح <Money amount={available} className="text-xs" />
            </span>
          )}
          <span aria-hidden className="block h-0.5 w-full bg-muted">
            <span
              className={cn(
                "block h-full",
                ratio >= 1
                  ? "bg-destructive"
                  : ratio >= 0.8
                    ? "bg-warning"
                    : "bg-primary",
              )}
              style={{ width: `${ratio * 100}%` }}
            />
          </span>
        </>
      )}
    </span>
  );
}

/** اختيار العميل بالبحث (الاسم أو الجوال) والأسهم وEnter. */
export function PosCustomerDialog() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.posUi.dialog === "customer");
  const customers = useAppSelector(selectCustomers);
  const loyaltyOn = useLoyaltyConfig().enabled;
  const selectedId = useAppSelector(selectInvoiceCustomer)?.id ?? null;
  const allowed = useFeature("customers");

  // بَسطة: البيع لعميل نقدي فقط. نفس النافذة (زر أو اختصار) تشرح الخطة المطلوبة.
  if (!allowed) {
    return (
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) dispatch(posUiActions.closeCustomerDialog());
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogTitle className="sr-only">العملاء</DialogTitle>
          <UpgradeNotice feature="customers" className="border-0 p-2" />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dispatch(posUiActions.closeCustomerDialog());
      }}
      className="sm:max-w-xl"
      title="اختيار العميل"
      description="ابحث بالاسم أو رقم الجوال، أو ارجع إلى عميل نقدي"
    >
      <PosPickerHeader
        icon={<IconUsers />}
        title="اختيار العميل"
        meta={`${customers.length} عملاء`}
      />
      <CommandInput placeholder="ابحث بالاسم أو رقم الجوال…" />
      <CommandList className="max-h-[55dvh]">
        <CommandEmpty>
          <div className="space-y-1 py-4 text-xs">
            <p className="text-sm font-medium text-foreground">
              لا يوجد عميل مطابق
            </p>
            <p className="text-muted-foreground">
              جرّب جزءاً من الاسم أو آخر أرقام الجوال.
            </p>
          </div>
        </CommandEmpty>

        <CommandGroup>
          <CommandItem
            value="عميل نقدي بدون حساب"
            keywords={["نقدي", "كاش"]}
            onSelect={() => dispatch(selectCustomer(null))}
            className={pickerItemClass}
          >
            <Avatar selected={selectedId === null}>
              <IconUser className="size-4" />
            </Avatar>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">عميل نقدي</span>
              <span className="block text-[11px] text-muted-foreground">
                بيع نقدي بدون حساب
              </span>
            </span>
            {selectedId === null && (
              <span className="sr-only">المحدد حالياً</span>
            )}
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="العملاء">
          {customers.map((customer) => {
            const selected = customer.id === selectedId;
            return (
              <CommandItem
                key={customer.id}
                value={`${customer.name} ${customer.phone}`}
                keywords={[toArabicDigits(customer.phone)]}
                onSelect={() => dispatch(selectCustomer(customer))}
                className={pickerItemClass}
              >
                <Avatar selected={selected}>
                  {[...customer.name.trim()][0]}
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {customer.name}
                  </span>
                  <span
                    dir="ltr"
                    className="flex gap-1 text-start font-mono text-[11px] text-muted-foreground"
                  >
                    <IconPhone />
                    {customer.phone}
                  </span>
                </span>
                {customer.isWholesale && (
                  <span className="shrink-0 bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                    جملة
                  </span>
                )}
                {loyaltyOn && (customer.loyaltyPoints ?? 0) > 0 && (
                  <span className="inline-flex shrink-0 items-center gap-0.5 bg-success/10 px-1.5 py-0.5 text-[10px] text-success">
                    <IconGift className="size-3" />
                    {customer.loyaltyPoints} نقطة
                  </span>
                )}
                <CreditStatus customer={customer} />
                {selected && <span className="sr-only">المحدد حالياً</span>}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
      <PosPickerFooter
        hints={[
          { keys: "↑ ↓", label: "تنقل" },
          { keys: "Enter", label: "اختيار" },
          { keys: "Esc", label: "إغلاق" },
        ]}
      />
    </CommandDialog>
  );
}
