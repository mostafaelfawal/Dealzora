"use client";

import {
  IconArrowsExchange,
  IconLoader2,
  IconRefresh,
  IconSettings,
} from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { ChartCard } from "@/components/shared/charts/ChartCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRefreshExchangeRate } from "@/features/settings/hooks/useSettings";
import { useCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/dates";
import {
  activeRate,
  formatAmount,
  fromSecond,
  rateSentence,
  toSecond,
  useExchange,
} from "@/lib/exchange";

/**
 * سعر الصرف اليوم + محوّل سريع (التاجر يحسب سعر صنف بالعملة الثانية بدون آلة حاسبة).
 * يظهر فقط لو العملة الثانية مفعّلة. السعر التلقائي القديم (أكثر من 6 ساعات) يتحدث وحده.
 */
export function DashboardExchange() {
  const main = useCurrency();
  const state = useExchange();
  const refresh = useRefreshExchangeRate();
  const silentRefresh = useRefreshExchangeRate({ silent: true });
  const tried = useRef(false);
  const [amount, setAmount] = useState("100");
  const [reverse, setReverse] = useState(false);

  const { config } = state;
  const auto = config.mode === "auto";

  useEffect(() => {
    if (!config.enabled || !auto || !state.stale || tried.current) return;
    tried.current = true;
    silentRefresh.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- مرة واحدة عند فتح اللوحة
  }, [config.enabled, auto, state.stale]);

  if (!config.enabled) return null;

  const rate = activeRate(state);
  const busy = refresh.isPending || silentRefresh.isPending;
  const n = Number(amount);
  const valid = amount !== "" && Number.isFinite(n) && n >= 0;
  const result = valid
    ? reverse
      ? fromSecond(n, state)
      : toSecond(n, state)
    : null;
  const [fromLabel, toLabel] = reverse
    ? [config.symbol, main.symbol]
    : [main.symbol, config.symbol];

  return (
    <ChartCard
      title="سعر الصرف اليوم"
      subtitle={
        rate
          ? auto
            ? `تلقائي من الإنترنت · آخر تحديث ${formatDateTime(rate.fetchedAt)}`
            : "سعر يدوي من الإعدادات"
          : "لا يوجد سعر بعد"
      }
      action={
        <div className="flex items-center gap-1">
          {auto && (
            <AppTooltip message="تحديث سعر الصرف">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="تحديث سعر الصرف"
                onClick={() => refresh.mutate()}
                disabled={busy}
              >
                {busy ? (
                  <IconLoader2 className="animate-spin" />
                ) : (
                  <IconRefresh />
                )}
              </Button>
            </AppTooltip>
          )}
          <AppTooltip message="إعدادات العملة الثانية">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="إعدادات العملة الثانية"
              nativeButton={false}
              render={<Link href="/admin/settings#exchange" />}
            >
              <IconSettings />
            </Button>
          </AppTooltip>
        </div>
      }
    >
      {rate ? (
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center">
          <RateFigure
            sentence={rateSentence(rate, main, config)}
            stale={auto && state.stale}
          />

          <div className="space-y-2 border-t pt-3 sm:border-t-0 sm:border-s sm:ps-4 sm:pt-0">
            <p className="text-[11px] font-medium text-muted-foreground">
              تحويل سريع
            </p>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  dir="ltr"
                  aria-label={`المبلغ بـ${reverse ? config.name : main.name}`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-10 pe-12 text-right font-mono"
                />
                <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {fromLabel}
                </span>
              </div>
              <AppTooltip message="عكس اتجاه التحويل">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="عكس اتجاه التحويل"
                  onClick={() => setReverse((v) => !v)}
                  className="size-10"
                >
                  <IconArrowsExchange className="size-4" />
                </Button>
              </AppTooltip>
            </div>
            <p className="flex items-baseline gap-1.5" aria-live="polite">
              <span className="text-xs text-muted-foreground">=</span>
              <span
                dir="ltr"
                className="font-mono text-xl font-bold tabular-nums"
              >
                {result === null
                  ? "—"
                  : formatAmount(result, reverse ? 2 : config.decimals)}
              </span>
              <span className="text-xs text-muted-foreground">{toLabel}</span>
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>
            {auto
              ? "تعذّر جلب السعر. تأكد من الإنترنت ثم اضغط تحديث."
              : "اكتب سعر الصرف من الإعدادات."}
          </p>
          {auto && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refresh.mutate()}
              disabled={busy}
              className="gap-1.5"
            >
              {busy ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                <IconRefresh className="size-4" />
              )}
              تحديث السعر
            </Button>
          )}
        </div>
      )}
    </ChartCard>
  );
}

function RateFigure({
  sentence,
  stale,
}: {
  sentence: { from: string; to: string; value: string };
  stale: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">1 {sentence.from} =</p>
      <p className="flex flex-wrap items-baseline gap-2">
        <span
          dir="ltr"
          className="font-mono text-3xl font-bold tracking-tight tabular-nums"
        >
          {sentence.value}
        </span>
        <span className="text-sm text-muted-foreground">{sentence.to}</span>
      </p>
      {stale && (
        <p className="text-[11px] text-warning">
          السعر قديم: لم يتحدث منذ أكثر من 6 ساعات.
        </p>
      )}
    </div>
  );
}
