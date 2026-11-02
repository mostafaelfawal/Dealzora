"use client";

import { IconReceiptRefund } from "@tabler/icons-react";

import { Money } from "@/components/shared/Money";
import { Button } from "@/components/ui/button";
import { formatQty } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { returnLineValue } from "../lib/returnCalc";
import { cancelExchange } from "../store/posActions";
import { selectExchange, selectReturnTotal } from "../store/selectors";

/** شريط يظهر أعلى الفاتورة أثناء الاستبدال ويبيّن ما سيُرجع. */
export function PosExchangeBanner() {
  const dispatch = useAppDispatch();
  const exchange = useAppSelector(selectExchange);
  const returnTotal = useAppSelector(selectReturnTotal);

  if (!exchange) return null;

  return (
    <div
      role="status"
      className="shrink-0 space-y-1.5 border-b bg-warning/10 px-3 py-2 text-xs"
    >
      <div className="flex items-center gap-2">
        <IconReceiptRefund className="size-4 shrink-0 text-warning" />
        <span className="font-medium">
          استبدال من فاتورة #{exchange.invoiceNumber}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => dispatch(cancelExchange())}
          className="ms-auto font-normal"
        >
          إلغاء الاستبدال
        </Button>
      </div>

      <ul className="max-h-20 space-y-0.5 overflow-y-auto">
        {exchange.lines.map((l) => (
          <li
            key={l.productId}
            className="flex items-center justify-between gap-2 text-muted-foreground"
          >
            <span className="truncate">
              {l.name}{" "}
              <bdi dir="ltr" className="font-mono">
                ×{formatQty(l.qty)}
              </bdi>
            </span>
            <Money
              amount={returnLineValue(l, exchange.discountRate)}
              className="text-xs"
            />
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between font-medium">
        <span>قيمة المرتجع</span>
        <Money amount={returnTotal} />
      </div>
      <p className="text-muted-foreground">
        أضف الأصناف الجديدة ثم اضغط «تسوية» (F9).
      </p>
    </div>
  );
}
