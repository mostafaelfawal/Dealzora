import { cn } from "@/lib/utils";

import { RECEIPT_STATUS } from "../config/receiptStatus";
import type { EReceiptStatus } from "../types/eta";

/** شارة حالة الإيصال في المنظومة. */
export function StatusChip({ status }: { status: EReceiptStatus }) {
  const s = RECEIPT_STATUS[status];
  return (
    <span
      className={cn(
        "px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
        s.tone,
      )}
    >
      {s.label}
    </span>
  );
}
