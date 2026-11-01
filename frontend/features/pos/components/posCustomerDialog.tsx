"use client";

import { IconCheck, IconPhone, IconUser, IconUsers } from "@tabler/icons-react";
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
import { cn } from "cn";
import type { PosCustomer } from "../types/pos";

import {
  PosPickerFooter,
  PosPickerHeader,
  pickerItemClass,
} from "./posPickerChrome";

interface PosCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: PosCustomer[];
  selectedId: string | null;
  onSelect: (customer: PosCustomer | null) => void;
}

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
/** لتعمل البحث برقم الجوال حتى لو كتبه الكاشير بالأرقام العربية. */
const toArabicDigits = (text: string) =>
  text.replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)]);

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
            عليه <Money amount={balance} className="text-foreground" />
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
export function PosCustomerDialog({
  open,
  onOpenChange,
  customers,
  selectedId,
  onSelect,
}: PosCustomerDialogProps) {
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
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
            onSelect={() => onSelect(null)}
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
                onSelect={() => onSelect(customer)}
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
