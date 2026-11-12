import { useSyncExternalStore } from "react";

/**
 * طرق الدفع الإلكتروني للمحل (محافظ، بطاقات، تحويلات فورية) ودولة القوالب.
 * مصدرها القاعدة (GET /settings) وتُحمَّل مع العملة عند فتح التطبيق.
 * الكاش والآجل والمختلط مدمجة ولا تظهر هنا.
 */
export type PaymentKind = "wallet" | "card" | "transfer";

export interface ElectronicMethod {
  /** يُخزَّن في الفاتورة (vodafone_cash، stc_pay، c_ab12cd...). */
  id: string;
  name: string;
  kind: PaymentKind;
  /** رقم المحفظة / IBAN / عنوان الدفع الذي يمليه الكاشير على العميل. */
  account: string | null;
  enabled: boolean;
}

export interface PaymentConfig {
  /** ISO مثل EG/SA. null = لم تُختر بعد. */
  country: string | null;
  methods: ElectronicMethod[];
}

export const PAYMENT_KIND_LABEL: Record<PaymentKind, string> = {
  wallet: "محفظة إلكترونية",
  card: "بطاقة / نقطة بيع",
  transfer: "تحويل فوري / بنكي",
};

/** نفس حدود الـ backend (settings/payments.py). */
export const PAYMENT_LIMITS = { methods: 12, name: 40, account: 60 };

const EMPTY: PaymentConfig = { country: null, methods: [] };

let current: PaymentConfig = EMPTY;
const listeners = new Set<() => void>();

export const getPaymentConfig = () => current;

export function setPaymentConfig(next: PaymentConfig) {
  if (JSON.stringify(next) === JSON.stringify(current)) return;
  current = next;
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function usePaymentConfig(): PaymentConfig {
  return useSyncExternalStore(subscribe, getPaymentConfig, () => EMPTY);
}

/** الطرق المفعّلة فقط (ما يظهر في الكاشير والفلاتر). */
export function useEnabledMethods(): ElectronicMethod[] {
  return usePaymentConfig().methods.filter((m) => m.enabled);
}
