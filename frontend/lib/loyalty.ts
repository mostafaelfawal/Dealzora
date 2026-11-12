import { useSyncExternalStore } from "react";

/**
 * نقاط الولاء. نفس حساب الـ backend (modules/loyalty/config.py) بالقروش وأعداد صحيحة:
 *   الكسب:     كل earnAmount جنيه مدفوع = نقطة.
 *   الاستبدال: كل redeemPoints نقطة = redeemValue جنيه خصم (بالباقات فقط).
 * الإعداد يُحمَّل مع العملة (GET /settings).
 */

export interface LoyaltyConfig {
  enabled: boolean;
  /** جنيه لكل نقطة. */
  earnAmount: number;
  /** حجم باقة الاستبدال (نقاط). */
  redeemPoints: number;
  /** قيمة الباقة بالجنيه. */
  redeemValue: number;
  /** أقصى نسبة من الفاتورة تُدفع بالنقاط. */
  maxRedeemPercent: number;
}

export const DEFAULT_LOYALTY: LoyaltyConfig = {
  enabled: false,
  earnAmount: 10,
  redeemPoints: 100,
  redeemValue: 5,
  maxRedeemPercent: 50,
};

const cents = (pounds: number) => Math.round(pounds * 100);

/** النقاط المكتسبة من مبلغ مدفوع. */
export function earnedPoints(cfg: LoyaltyConfig, paid: number): number {
  const earn = cents(cfg.earnAmount);
  if (!cfg.enabled || paid <= 0 || earn <= 0) return 0;
  return Math.floor(cents(paid) / earn);
}

/** قيمة خصم عدد نقاط (مضاعف للباقة) بالجنيه. */
export function redeemDiscount(cfg: LoyaltyConfig, points: number): number {
  if (!cfg.enabled || points <= 0) return 0;
  return (Math.floor(points / cfg.redeemPoints) * cents(cfg.redeemValue)) / 100;
}

/** أقصى نقاط تُستبدل: من الرصيد، وبحد النسبة من قيمة الفاتورة قبل النقاط. */
export function maxRedeemable(
  cfg: LoyaltyConfig,
  balance: number,
  baseAmount: number,
): number {
  if (!cfg.enabled || balance < cfg.redeemPoints || baseAmount <= 0) return 0;
  const cap = Math.floor((cents(baseAmount) * cfg.maxRedeemPercent) / 100);
  const blocks = Math.min(
    Math.floor(balance / cfg.redeemPoints),
    Math.floor(cap / cents(cfg.redeemValue)),
  );
  return Math.max(blocks, 0) * cfg.redeemPoints;
}

/** «كل 10 ج = نقطة · 100 نقطة = 5 ج» للعرض. */
export function loyaltyRuleText(cfg: LoyaltyConfig, symbol: string): string {
  return `كل ${cfg.earnAmount} ${symbol} = نقطة · ${cfg.redeemPoints} نقطة = ${cfg.redeemValue} ${symbol} خصم`;
}

// ---------- مخزن الإعداد ----------
let current: LoyaltyConfig = DEFAULT_LOYALTY;
const listeners = new Set<() => void>();

export const getLoyaltyConfig = () => current;

export function setLoyaltyConfig(next: LoyaltyConfig) {
  if (JSON.stringify(next) === JSON.stringify(current)) return;
  current = next;
  listeners.forEach((fn) => fn());
}

export function useLoyaltyConfig(): LoyaltyConfig {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getLoyaltyConfig,
    () => DEFAULT_LOYALTY,
  );
}

// ---------- شكل الـ backend (قروش) ----------
export interface LoyaltyDto {
  enabled: boolean;
  earn_amount: number;
  redeem_points: number;
  redeem_value: number;
  max_redeem_percent: number;
}

export const fromLoyaltyDto = (d: LoyaltyDto | undefined): LoyaltyConfig =>
  d
    ? {
        enabled: d.enabled,
        earnAmount: d.earn_amount / 100,
        redeemPoints: d.redeem_points,
        redeemValue: d.redeem_value / 100,
        maxRedeemPercent: d.max_redeem_percent,
      }
    : DEFAULT_LOYALTY;

export const toLoyaltyDto = (c: LoyaltyConfig): LoyaltyDto => ({
  enabled: c.enabled,
  earn_amount: cents(c.earnAmount),
  redeem_points: Math.round(c.redeemPoints),
  redeem_value: cents(c.redeemValue),
  max_redeem_percent: Math.round(c.maxRedeemPercent),
});
