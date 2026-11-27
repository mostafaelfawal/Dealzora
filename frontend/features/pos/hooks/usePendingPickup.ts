"use client";

import { useEffect, useRef } from "react";

import { takePendingPickup } from "@/features/reservations/lib/pendingPickup";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";

import { loadReservation } from "../store/posActions";

/**
 * «استلام في الكاشير» من صفحة الحجوزات: بعد استعادة مسودة الجهاز وتحميل الأصناف
 * يُحمَّل الحجز في الفاتورة (مرة واحدة).
 */
export function usePendingPickup() {
  const dispatch = useAppDispatch();
  const hydrated = useAppSelector((s) => s.cart.hydrated);
  const catalogReady = useAppSelector((s) => s.catalog.products.length > 0);
  const done = useRef(false);

  useEffect(() => {
    if (done.current || !hydrated || !catalogReady) return;
    done.current = true;
    const id = takePendingPickup();
    if (id) void dispatch(loadReservation(id));
  }, [dispatch, hydrated, catalogReady]);
}
