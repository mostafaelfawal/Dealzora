"use client";

import { IconUser } from "@tabler/icons-react";

import { Money } from "@/components/shared/Money";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { PosCustomer } from "@/types/pos";

interface PosCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: PosCustomer[];
  selectedId: string | null;
  onSelect: (customer: PosCustomer | null) => void;
}

/** اختيار العميل بالبحث (اسم أو موبايل) والأسهم وEnter. */
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
      className="sm:max-w-lg"
      title="اختيار العميل"
      description="ابحث بالاسم أو رقم الموبايل، أو ارجع لعميل نقدي"
    >
      <CommandInput placeholder="اسم العميل أو رقم الموبايل…" />
      <CommandList>
        <CommandEmpty>مفيش عميل مطابق</CommandEmpty>
        <CommandGroup>
          <CommandItem
            value="عميل نقدي بدون حساب"
            onSelect={() => onSelect(null)}
          >
            <IconUser className="size-4" />
            <span>عميل نقدي (بدون حساب)</span>
            {selectedId === null && (
              <span className="ms-auto text-muted-foreground">
                المحدد حالياً
              </span>
            )}
          </CommandItem>
          {customers.map((customer) => (
            <CommandItem
              key={customer.id}
              value={`${customer.name} ${customer.phone}`}
              onSelect={() => onSelect(customer)}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {customer.name}
                </span>
                <span
                  dir="ltr"
                  className="block text-start font-mono text-[11px] text-muted-foreground"
                >
                  {customer.phone}
                </span>
              </span>
              <span className="flex items-baseline gap-1 text-muted-foreground">
                {customer.balance > 0 ? (
                  <>
                    عليه <Money amount={customer.balance} />
                  </>
                ) : (
                  "مفيش مديونية"
                )}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
