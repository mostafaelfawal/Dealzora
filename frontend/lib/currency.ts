import { useSyncExternalStore } from "react";

/**
 * عملة المحل. مصدرها القاعدة (GET /settings) ويحمّلها <CurrencySync /> عند فتح التطبيق.
 * مخزن في الذاكرة فقط (ليس localStorage): المدير يغيّرها من الإعدادات للجميع.
 *
 * - في المكوّنات: useCurrency() أو <CurrencyLabel /> (يُعاد الرسم عند التغيير).
 * - في النصوص خارج React (الإيصال، الملصق، رسائل التحقق): currencySymbol() / currencyName().
 */
export interface Currency {
  code: string;
  symbol: string;
  name: string;
}

export const DEFAULT_CURRENCY: Currency = {
  code: "EGP",
  symbol: "ج.م",
  name: "جنيه مصري",
};

let current: Currency = DEFAULT_CURRENCY;
const listeners = new Set<() => void>();

export const getCurrency = () => current;
export const currencySymbol = () => current.symbol;
export const currencyName = () => current.name;

export function setCurrency(next: Currency) {
  if (
    next.code === current.code &&
    next.symbol === current.symbol &&
    next.name === current.name
  )
    return;
  current = next;
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useCurrency(): Currency {
  return useSyncExternalStore(subscribe, getCurrency, () => DEFAULT_CURRENCY);
}
