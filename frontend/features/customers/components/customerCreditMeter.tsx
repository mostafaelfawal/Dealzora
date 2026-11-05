import { Money } from "@/components/shared/Money";
import { ProgressBar } from "@/components/shared/motion";
import { cn } from "@/lib/utils";

import {
  availableCredit,
  creditRatio,
  getCreditLevel,
} from "../lib/customerCalc";
import type { CreditLevel, Customer } from "../types/customer";

const BAR_TONE: Record<CreditLevel, string> = {
  cash: "",
  ok: "bg-primary",
  warn: "bg-warning",
  full: "bg-destructive",
};

/** شريط استهلاك الحد الائتماني + المتاح. نفس منطق شاشة اختيار العميل في الكاشير. */
export function CustomerCreditMeter({
  customer,
  className,
}: {
  customer: Customer;
  className?: string;
}) {
  const level = getCreditLevel(customer);

  if (level === "cash") {
    return (
      <p className={cn("text-[11px] text-muted-foreground", className)}>
        بيع نقدي فقط (بدون حد ائتماني)
      </p>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="flex items-baseline gap-1">
          الحد
          <Money amount={customer.creditLimit} className="text-[11px]" />
        </span>
        {level === "full" ? (
          <span className="text-destructive">لا متاح</span>
        ) : (
          <span className="flex items-baseline gap-1">
            المتاح
            <Money
              amount={availableCredit(customer)}
              className="text-[11px] text-foreground"
            />
          </span>
        )}
      </div>
      <ProgressBar
        value={creditRatio(customer)}
        className="h-0.5"
        barClassName={BAR_TONE[level]}
      />
    </div>
  );
}
