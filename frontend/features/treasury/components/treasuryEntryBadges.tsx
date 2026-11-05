import { IconLink } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { KIND_LABEL } from "../config/treasuryOptions";
import type { CashEntry } from "../types/treasury";

/** شارات الحركة: النوع + "تلقائي" للحركات المرتبطة بمصدر (نص + أيقونة، وليس لوناً وحده). */
export function TreasuryEntryBadges({ entry }: { entry: CashEntry }) {
  return (
    <>
      <Badge
        variant="outline"
        className={cn(
          "font-normal",
          entry.direction === "in"
            ? "border-success/50 text-success"
            : "border-destructive/50 text-destructive",
        )}
      >
        {KIND_LABEL[entry.kind]}
      </Badge>
      {entry.isLinked && (
        <Badge variant="secondary" className="gap-1 font-normal">
          <IconLink />
          تلقائي
        </Badge>
      )}
    </>
  );
}
