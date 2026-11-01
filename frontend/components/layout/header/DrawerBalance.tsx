import { IconCash } from "@tabler/icons-react";
import Link from "next/link";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { Money } from "@/components/shared/Money";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DrawerBalanceProps {
  amount: number;
  showLabels?: boolean;
}

export function DrawerBalance({
  amount,
  showLabels = false,
}: DrawerBalanceProps) {
  return (
    <AppTooltip message="رصيد الدرج الحالي">
      <Button
        variant="ghost"
        size="lg"
        nativeButton={false}
        render={<Link href="/shifts" />}
        className="gap-2 px-2 font-normal"
      >
        <IconCash className="size-4 text-muted-foreground" />
        <span
          className={cn(
            "text-sm text-muted-foreground",
            showLabels ? "inline" : "sr-only xl:not-sr-only",
          )}
        >
          الدرج
        </span>
        <Money amount={amount} className="text-sm" />
      </Button>
    </AppTooltip>
  );
}
