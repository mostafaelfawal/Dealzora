"use client";

import { IconDeviceFloppy, IconGift, IconLoader2 } from "@tabler/icons-react";
import { useState, type FormEvent, type ReactNode } from "react";

import { Num } from "@/components/shared/Num";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { currencySymbol } from "@/lib/currency";
import { formatQty, normalizeDigits, parseNumberInput } from "@/lib/format";
import {
  earnedPoints,
  redeemDiscount,
  useLoyaltyConfig,
  type LoyaltyConfig,
} from "@/lib/loyalty";
import { cn } from "@/lib/utils";

import { useSaveLoyalty } from "../hooks/useSettings";

type Draft = Record<
  "earnAmount" | "redeemPoints" | "redeemValue" | "maxRedeemPercent",
  string
> & { enabled: boolean };

const toDraft = (c: LoyaltyConfig): Draft => ({
  enabled: c.enabled,
  earnAmount: String(c.earnAmount),
  redeemPoints: String(c.redeemPoints),
  redeemValue: String(c.redeemValue),
  maxRedeemPercent: String(c.maxRedeemPercent),
});

const num = (t: string) => parseNumberInput(normalizeDigits(t));

function parse(d: Draft): {
  config: LoyaltyConfig | null;
  error: string | null;
} {
  const earn = num(d.earnAmount);
  const points = num(d.redeemPoints);
  const value = num(d.redeemValue);
  const pct = num(d.maxRedeemPercent);
  if (!(earn > 0)) return { config: null, error: "اكتب المبلغ اللي يكسب نقطة" };
  if (!(Number.isInteger(points) && points >= 1))
    return { config: null, error: "عدد نقاط الاستبدال رقم صحيح" };
  if (!(value > 0)) return { config: null, error: "اكتب قيمة الخصم" };
  if (!(Number.isInteger(pct) && pct >= 1 && pct <= 100))
    return { config: null, error: "النسبة من 1 إلى 100" };
  return {
    config: {
      enabled: d.enabled,
      earnAmount: earn,
      redeemPoints: points,
      redeemValue: value,
      maxRedeemPercent: pct,
    },
    error: null,
  };
}

function Inline({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">{children}</div>
  );
}

function NumInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode="decimal"
      dir="ltr"
      aria-label={label}
      className="h-10 w-20 text-center font-mono"
    />
  );
}

/** نقاط الولاء: العميل يكسب نقاط على مشترياته ويستبدلها خصماً. */
export function LoyaltySection() {
  const saved = useLoyaltyConfig();
  const save = useSaveLoyalty();
  const [draft, setDraft] = useState<Draft | null>(null);
  const d = draft ?? toDraft(saved);
  const { config, error } = parse(d);
  const changed =
    config !== null && JSON.stringify(config) !== JSON.stringify(saved);
  const patch = (p: Partial<Draft>) => setDraft({ ...d, ...p });
  const symbol = currencySymbol();

  // مثال حيّ: مشتريات 500 → كام نقطة، وكام يرجع للعميل فعلياً.
  const example = config ? { ...config, enabled: true } : null;
  const sample = 500;
  const sampleEarn = example ? earnedPoints(example, sample) : 0;
  const backRate = example
    ? (example.redeemValue / example.redeemPoints / example.earnAmount) * 100
    : 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!config || !changed) return;
    save.mutate(config, { onSuccess: () => setDraft(null) });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="loyalty-enabled" className="flex-1">
          تشغيل نقاط الولاء للعملاء
        </Label>
        <Switch
          id="loyalty-enabled"
          checked={d.enabled}
          onCheckedChange={(enabled) => patch({ enabled })}
        />
      </div>

      <div className={cn("space-y-4", !d.enabled && "opacity-60")}>
        <div className="space-y-2 border p-3">
          <p className="text-xs font-medium text-muted-foreground">
            ١) العميل يكسب
          </p>
          <Inline>
            كل
            <NumInput
              label="المبلغ لكل نقطة"
              value={d.earnAmount}
              onChange={(earnAmount) => patch({ earnAmount })}
            />
            {symbol} يشتري بيهم = نقطة واحدة
          </Inline>
        </div>

        <div className="space-y-2 border p-3">
          <p className="text-xs font-medium text-muted-foreground">
            ٢) ويستبدلها
          </p>
          <Inline>
            كل
            <NumInput
              label="نقاط الباقة"
              value={d.redeemPoints}
              onChange={(redeemPoints) => patch({ redeemPoints })}
            />
            نقطة = خصم
            <NumInput
              label="قيمة الباقة"
              value={d.redeemValue}
              onChange={(redeemValue) => patch({ redeemValue })}
            />
            {symbol}
          </Inline>
          <Inline>
            بحد أقصى
            <NumInput
              label="أقصى نسبة"
              value={d.maxRedeemPercent}
              onChange={(maxRedeemPercent) => patch({ maxRedeemPercent })}
            />
            % من قيمة الفاتورة (الباقي يدفعه فلوس)
          </Inline>
        </div>

        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : (
          example && (
            <div className="flex gap-3 bg-success/5 p-3 text-sm">
              <IconGift className="mt-0.5 size-5 shrink-0 text-success" />
              <p className="leading-relaxed">
                عميل اشترى بـ <Num>{sample}</Num> {symbol} يكسب{" "}
                <Num>{sampleEarn}</Num> نقطة. لما يجمع{" "}
                <Num>{example.redeemPoints}</Num> نقطة يخصم{" "}
                <Num>
                  {formatQty(redeemDiscount(example, example.redeemPoints))}
                </Num>{" "}
                {symbol}. يعني بترجّع له حوالي{" "}
                <Num>{formatQty(Math.round(backRate * 100) / 100)}%</Num> من
                مشترياته.
              </p>
            </div>
          )
        )}
      </div>

      <div className="flex justify-end border-t pt-3">
        <Button
          type="submit"
          size="lg"
          disabled={!changed || save.isPending}
          className="h-10 gap-2"
        >
          {save.isPending ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconDeviceFloppy className="size-4" />
          )}
          حفظ
        </Button>
      </div>
    </form>
  );
}
