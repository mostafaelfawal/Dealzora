import { IconAlertTriangle, IconClock, IconGift } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";

import { getCreditLevel, isOverdue } from "../lib/customerCalc";
import type { Customer } from "../types/customer";

/** شارات حالة العميل: نص + أيقونة، وليس لوناً وحده. تظهر فقط عند وجود ما يستحق التنبيه. */
export function CustomerStatusBadges({ customer }: { customer: Customer }) {
  const level = getCreditLevel(customer);
  const hasDebt = customer.balance > 0;

  return (
    <>
      {customer.isWholesale && (
        <Badge
          variant="outline"
          className="border-primary/40 font-normal text-primary"
        >
          جملة
        </Badge>
      )}
      {customer.loyaltyPoints > 0 && (
        <Badge
          variant="outline"
          className="gap-1 border-success/40 font-normal text-success"
        >
          <IconGift />
          {customer.loyaltyPoints} نقطة
        </Badge>
      )}
      {!customer.isActive && (
        <Badge variant="secondary" className="font-normal">
          معطّل
        </Badge>
      )}
      {isOverdue(customer) && (
        <Badge
          variant="outline"
          className="gap-1 border-destructive/50 font-normal text-destructive"
        >
          <IconClock />
          متأخر في السداد
        </Badge>
      )}
      {level === "full" && hasDebt && (
        <Badge
          variant="outline"
          className="gap-1 border-destructive/50 font-normal text-destructive"
        >
          <IconAlertTriangle />
          بلغ الحد
        </Badge>
      )}
      {level === "warn" && (
        <Badge
          variant="outline"
          className="gap-1 border-warning/50 font-normal text-warning"
        >
          <IconAlertTriangle />
          قارب الحد
        </Badge>
      )}
      {level === "cash" && (
        <Badge variant="outline" className="font-normal text-muted-foreground">
          نقدي فقط
        </Badge>
      )}
    </>
  );
}
