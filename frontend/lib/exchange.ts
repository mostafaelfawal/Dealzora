import { useSyncExternalStore } from "react";

import type { Currency } from "./currency";

/**
 * العملة الثانية وسعر الصرف (المحل يبيع بعملته ويعرض المقابل بعملة ثانية، مثل دولار ← ليرة).
 * المصدر: GET /settings → exchange (الـ backend يجلب السعر من الإنترنت ويحفظ آخر سعر).
 * مخزن في الذاكرة يُقرأ خارج React أيضاً (الإيصال المطبوع).
 */
export interface ExchangeConfig {
  enabled: boolean;
  code: string;
  symbol: string;
  name: string;
  mode: "auto" | "manual";
  manualRate: number | null;
  /** main: 1 من عملة المحل = manualRate من الثانية. second: 1 من الثانية = manualRate من عملة المحل. */
  manualBase: "main" | "second";
  decimals: number;
  showInPos: boolean;
  showOnReceipt: boolean;
}

export interface ExchangeRate {
  main: string;
  second: string;
  /** كم وحدة من الثانية = 1 من عملة المحل. */
  secondPerMain: number;
  source: string;
  /** ms، 0 للسعر اليدوي. */
  rateUpdatedAt: number;
  fetchedAt: number;
}

export interface ExchangeState {
  config: ExchangeConfig;
  rate: ExchangeRate | null;
  stale: boolean;
}

export const DEFAULT_EXCHANGE_CONFIG: ExchangeConfig = {
  enabled: false,
  code: "USD",
  symbol: "$",
  name: "دولار أمريكي",
  mode: "auto",
  manualRate: null,
  manualBase: "second",
  decimals: 2,
  showInPos: true,
  showOnReceipt: true,
};

const EMPTY: ExchangeState = {
  config: DEFAULT_EXCHANGE_CONFIG,
  rate: null,
  stale: false,
};

let current: ExchangeState = EMPTY;
const listeners = new Set<() => void>();

export const getExchange = () => current;

export function setExchange(next: ExchangeState) {
  current = next;
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useExchange(): ExchangeState {
  return useSyncExternalStore(subscribe, getExchange, () => EMPTY);
}

/** السعر جاهز للاستخدام (مفعّل وفيه سعر). */
export const activeRate = (s: ExchangeState = current) =>
  s.config.enabled && s.rate ? s.rate : null;

/* ---------- التحويل والعرض ---------- */

export function toSecond(
  amount: number,
  s: ExchangeState = current,
): number | null {
  const rate = activeRate(s);
  if (!rate) return null;
  const factor = 10 ** s.config.decimals;
  return Math.round(amount * rate.secondPerMain * factor) / factor;
}

export function fromSecond(
  amount: number,
  s: ExchangeState = current,
): number | null {
  const rate = activeRate(s);
  if (!rate || rate.secondPerMain <= 0) return null;
  return Math.round((amount / rate.secondPerMain) * 100) / 100;
}

export function formatAmount(n: number, decimals: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** «4,475,000 ل.ل» أو null لو لا سعر. */
export function formatSecond(
  amount: number,
  s: ExchangeState = current,
): string | null {
  const v = toSecond(amount, s);
  return v === null
    ? null
    : `${formatAmount(v, s.config.decimals)} ${s.config.symbol}`;
}

/** أرقام السعر بدقة مناسبة (0.0186 أو 53.74 أو 89,500). */
function formatRateNumber(n: number): string {
  const digits = n >= 100 ? 0 : n >= 1 ? 2 : 4;
  return formatAmount(n, digits);
}

/**
 * السعر بالاتجاه الأوضح للتاجر: الوحدة الأكبر قيمة على اليسار.
 * «1 دولار أمريكي = 89,500 ليرة لبنانية» بدل «1 ليرة = 0.0000112 دولار».
 */
export function rateSentence(
  rate: ExchangeRate,
  main: Currency,
  second: Pick<ExchangeConfig, "name" | "symbol">,
): { from: string; to: string; value: string; text: string } {
  const mainIsBigger = rate.secondPerMain >= 1;
  const from = mainIsBigger ? main.name : second.name;
  const to = mainIsBigger ? second.name : main.name;
  const value = formatRateNumber(
    mainIsBigger ? rate.secondPerMain : 1 / rate.secondPerMain,
  );
  return { from, to, value, text: `1 ${from} = ${value} ${to}` };
}

/* ---------- DTO ---------- */

interface ExchangeConfigDto {
  enabled: boolean;
  code: string;
  symbol: string;
  name: string;
  mode: "auto" | "manual";
  manual_rate: number | null;
  manual_base: "main" | "second";
  decimals: number;
  show_in_pos: boolean;
  show_on_receipt: boolean;
}

interface ExchangeRateDto {
  main: string;
  second: string;
  second_per_main: number;
  source: string;
  rate_updated_at: number;
  fetched_at: number;
}

export interface ExchangeDto {
  config: ExchangeConfigDto;
  rate: ExchangeRateDto | null;
  stale: boolean;
}

export const fromExchangeDto = (d: ExchangeDto | undefined): ExchangeState =>
  d
    ? {
        config: {
          enabled: d.config.enabled,
          code: d.config.code,
          symbol: d.config.symbol,
          name: d.config.name,
          mode: d.config.mode,
          manualRate: d.config.manual_rate,
          manualBase: d.config.manual_base,
          decimals: d.config.decimals,
          showInPos: d.config.show_in_pos,
          showOnReceipt: d.config.show_on_receipt,
        },
        rate: d.rate
          ? {
              main: d.rate.main,
              second: d.rate.second,
              secondPerMain: d.rate.second_per_main,
              source: d.rate.source,
              rateUpdatedAt: d.rate.rate_updated_at * 1000,
              fetchedAt: d.rate.fetched_at * 1000,
            }
          : null,
        stale: d.stale,
      }
    : EMPTY;

export const toExchangeConfigDto = (c: ExchangeConfig): ExchangeConfigDto => ({
  enabled: c.enabled,
  code: c.code,
  symbol: c.symbol,
  name: c.name,
  mode: c.mode,
  manual_rate: c.manualRate,
  manual_base: c.manualBase,
  decimals: c.decimals,
  show_in_pos: c.showInPos,
  show_on_receipt: c.showOnReceipt,
});
