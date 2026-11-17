"use client";

import { IconArrowsExchange } from "@tabler/icons-react";
import { useSyncExternalStore } from "react";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { Money } from "@/components/shared/Money";
import { useCurrency } from "@/lib/currency";
import {
  activeRate,
  formatAmount,
  rateSentence,
  toSecond,
  useExchange,
} from "@/lib/exchange";
import { cn } from "@/lib/utils";

/**
 * الإجمالي في الكاشير بالعملتين. الكاشير يختار أيهما يظهر كبيراً بضغطة
 * (مثلاً المحل بالدولار والزبون يدفع بالليرة)، والاختيار محفوظ على هذا الجهاز.
 */
const KEY = "dealzora:pos:second-big";
const EVENT = "dealzora:pos-second-big";

function readBig(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function setBig(value: boolean) {
  try {
    localStorage.setItem(KEY, value ? "1" : "0");
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(fn: () => void) {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

/** هل العملة الثانية مفعّلة للكاشير وفيها سعر. */
export function usePosSecondCurrency() {
  const state = useExchange();
  const big = useSyncExternalStore(subscribe, readBig, () => false);
  const enabled = state.config.showInPos && activeRate(state) !== null;
  return { state, enabled, secondBig: enabled && big };
}

/** المبلغ الكبير: بعملة المحل أو بالعملة الثانية حسب اختيار الكاشير. */
export function PosGrandAmount({
  amount,
  className,
}: {
  amount: number;
  className?: string;
}) {
  const { state, secondBig } = usePosSecondCurrency();
  if (!secondBig) return <Money amount={amount} className={className} />;
  const v = toSecond(amount, state) ?? 0;
  return (
    <span className={cn("inline-flex items-baseline gap-1", className)}>
      <span dir="ltr" className="font-mono font-medium tabular-nums">
        {formatAmount(v, state.config.decimals)}
      </span>
      <span className="text-xs text-muted-foreground">
        {state.config.symbol}
      </span>
    </span>
  );
}

/** سطر صغير تحت الإجمالي: المقابل بالعملة الأخرى + سعر الصرف + زر التبديل. */
export function PosSecondCurrencyRow({ amount }: { amount: number }) {
  const main = useCurrency();
  const { state, enabled, secondBig } = usePosSecondCurrency();
  const rate = activeRate(state);
  if (!enabled || !rate) return null;

  const other = secondBig ? (
    <Money amount={amount} className="text-sm" />
  ) : (
    <span className="inline-flex items-baseline gap-1 text-sm">
      <span dir="ltr" className="font-mono font-medium tabular-nums">
        {formatAmount(toSecond(amount, state) ?? 0, state.config.decimals)}
      </span>
      <span className="text-xs text-muted-foreground">
        {state.config.symbol}
      </span>
    </span>
  );

  return (
    <div className="flex items-center justify-between gap-2 px-4 pb-2 text-xs">
      <span className="truncate text-muted-foreground">
        {rateSentence(rate, main, state.config).text}
      </span>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground" aria-hidden>
          ≈
        </span>
        {other}
        <AppTooltip
          message={`إظهار الإجمالي بـ${secondBig ? main.name : state.config.name}`}
        >
          <button
            type="button"
            onClick={() => setBig(!secondBig)}
            aria-label={`إظهار الإجمالي بـ${secondBig ? main.name : state.config.name}`}
            className="flex size-7 items-center justify-center border text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
          >
            <IconArrowsExchange className="size-4" />
          </button>
        </AppTooltip>
      </div>
    </div>
  );
}
