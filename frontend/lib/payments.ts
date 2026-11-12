import { useSyncExternalStore } from "react";

/**
 * حسابات المحل للدفع الإلكتروني (فودافون كاش وإنستاباي). مصدرها القاعدة (GET /settings)
 * وتُحمَّل مع العملة عند فتح التطبيق. الفارغ = الطريقة غير مفعّلة في الكاشير.
 */
export interface PaymentAccounts {
  vodafoneCash: string | null;
  instapay: string | null;
}

const EMPTY: PaymentAccounts = { vodafoneCash: null, instapay: null };

let current: PaymentAccounts = EMPTY;
const listeners = new Set<() => void>();

export const getPaymentAccounts = () => current;

export function setPaymentAccounts(next: PaymentAccounts) {
  if (
    next.vodafoneCash === current.vodafoneCash &&
    next.instapay === current.instapay
  )
    return;
  current = next;
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function usePaymentAccounts(): PaymentAccounts {
  return useSyncExternalStore(subscribe, getPaymentAccounts, () => EMPTY);
}
