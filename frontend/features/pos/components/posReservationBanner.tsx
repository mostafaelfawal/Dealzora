"use client";

import { IconCalendarEvent } from "@tabler/icons-react";

import { Money } from "@/components/shared/Money";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";

import { cartActions } from "../store/cartSlice";

/** شريط أعلى الفاتورة عند استلام حجز: الحفظ يُغلق الحجز ويُخصم العربون من رصيد العميل. */
export function PosReservationBanner() {
  const dispatch = useAppDispatch();
  const reservation = useAppSelector((s) => s.cart.present.reservation);

  if (!reservation) return null;

  return (
    <div
      role="status"
      className="flex shrink-0 items-center gap-2 border-b bg-primary/10 px-3 py-2 text-xs"
    >
      <IconCalendarEvent className="size-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="font-medium">استلام الحجز #{reservation.number}</span>
        {reservation.deposit > 0 && (
          <span className="text-muted-foreground">
            {" · العربون "}
            <Money amount={reservation.deposit} className="text-xs" />
            {" يُخصم عند الدفع"}
          </span>
        )}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => dispatch(cartActions.detachReservation())}
        className="font-normal"
      >
        فصل الحجز
      </Button>
    </div>
  );
}
