"use client";

import { useEffect } from "react";

import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { cartActions, type PersistedCart } from "../store/cartSlice";
import { migrateLocalHeld, refreshHeld } from "../store/posActions";

const STORAGE_KEY = "dealzora:pos:v1";
/** المعلّقة على الجهاز الأساسي تتحدث كل 15 ثانية (تعليقات الأجهزة الأخرى وقفل الورديات). */
const HELD_POLL_MS = 15_000;

/**
 * الفاتورة المفتوحة: localStorage (مسودة هذا الجهاز؛ لا يضيّعها انقطاع الكهرباء أو الشبكة).
 * المعلّقة: على الجهاز الأساسي (تظهر لكل الأجهزة). المعلّقات القديمة في المتصفح تُرحَّل مرة.
 */
export function usePosPersistence() {
  const dispatch = useAppDispatch();
  const hydrated = useAppSelector((s) => s.cart.hydrated);
  const invoice = useAppSelector((s) => s.cart.present);
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

    const legacy = Array.isArray(data.held) ? data.held : [];
    if (legacy.length) {
      void dispatch(migrateLocalHeld(legacy)).then((done) => {
        if (!done) return; // نعيد المحاولة في الفتح القادم
        try {
          // نقرأ الأحدث (الكاشير ربما أضاف أصنافاً أثناء الرفع) ونحذف held فقط.
          const now = JSON.parse(
            localStorage.getItem(STORAGE_KEY) ?? "{}",
          ) as Partial<PersistedCart>;
          delete now.held;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(now));
        } catch {
          // تجاهل.
        }
      });
    } else {
      void dispatch(refreshHeld());
    }
    const timer = setInterval(() => void dispatch(refreshHeld()), HELD_POLL_MS);
    return () => clearInterval(timer);
  }, [dispatch]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      // نحافظ على أي معلّقات قديمة لم تُرحَّل بعد (لا نمسحها قبل نجاح الرفع).
      const raw = localStorage.getItem(STORAGE_KEY);
      const prev = raw ? (JSON.parse(raw) as Partial<PersistedCart>) : {};
      const data: PersistedCart = { invoice, nextNumber, held: prev.held };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // تجاهل.
    }
  }, [hydrated, invoice, nextNumber]);
}
