"use client";

import { useEffect } from "react";

import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { cartActions, type PersistedCart } from "../store/cartSlice";

const STORAGE_KEY = "dealzora:pos:v1";

/**
 * يحمّل الفاتورة الحالية والمعلّقة من localStorage أول ما الشاشة تفتح،
 * ويحفظها عند أي تغيير. حتى لا يضيّع انقطاع الكهرباء أو تحديث الصفحة فاتورة قيد العمل.
 */
export function usePosPersistence() {
  const dispatch = useAppDispatch();
  const hydrated = useAppSelector((s) => s.cart.hydrated);
  const invoice = useAppSelector((s) => s.cart.present);
  const held = useAppSelector((s) => s.cart.held);
  const nextNumber = useAppSelector((s) => s.cart.nextNumber);

  useEffect(() => {
    let data: Partial<PersistedCart> = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) data = JSON.parse(raw) as Partial<PersistedCart>;
    } catch {
      // بيانات تالفة أو التخزين غير متاح: نبدأ فاتورة جديدة.
    }
    dispatch(cartActions.hydrate(data));
  }, [dispatch]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const data: PersistedCart = { invoice, held, nextNumber };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // تجاهل.
    }
  }, [hydrated, invoice, held, nextNumber]);
}
