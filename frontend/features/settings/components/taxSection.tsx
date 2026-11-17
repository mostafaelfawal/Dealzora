"use client";

import {
  IconDeviceFloppy,
  IconInfoCircle,
  IconLoader2,
} from "@tabler/icons-react";
import { useState, type FormEvent } from "react";

import { Num } from "@/components/shared/Num";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { currencySymbol } from "@/lib/currency";
import { formatNumber, normalizeDigits, parseNumberInput } from "@/lib/format";
import {
  splitLine,
  taxMode,
  toBasisPoints,
  useTaxConfig,
  type TaxConfig,
} from "@/lib/tax";
import { cn } from "@/lib/utils";

import { useSaveTax } from "../hooks/useSettings";

interface Draft {
  enabled: boolean;
  pricesIncludeTax: boolean;
  defaultRate: string;
}

const toDraft = (c: TaxConfig): Draft => ({
  enabled: c.enabled,
  pricesIncludeTax: c.pricesIncludeTax,
  defaultRate: String(c.defaultRate),
});

function parse(d: Draft): { config: TaxConfig | null; error: string | null } {
  const rate = parseNumberInput(normalizeDigits(d.defaultRate));
  // نقاط أساس صحيحة: حتى منزلتين عشريتين (2.5% أو 14%).
  if (
    !(rate > 0 && rate <= 100) ||
    Math.abs(toBasisPoints(rate) - rate * 100) > 1e-6
  )
    return { config: null, error: "النسبة من 0.01 إلى 100" };
  return {
    config: {
      enabled: d.enabled,
      pricesIncludeTax: d.pricesIncludeTax,
      defaultRate: rate,
    },
    error: null,
  };
}

const MODES = [
  {
    include: true,
    title: "الأسعار شاملة الضريبة",
    hint: "سعر الصنف هو ما يدفعه العميل، والضريبة جزء منه. أسعارك الحالية لا تتغير.",
  },
  {
    include: false,
    title: "الأسعار قبل الضريبة",
    hint: "تُضاف الضريبة على إجمالي الفاتورة، فيدفع العميل أكثر من سعر الصنف.",
  },
];

/** ضريبة القيمة المضافة: تشغيل + طريقة الأسعار + النسبة الافتراضية للأصناف الجديدة. */
export function TaxSection() {
  const saved = useTaxConfig();
  const save = useSaveTax();
  const [draft, setDraft] = useState<Draft | null>(null);
  const d = draft ?? toDraft(saved);
  const { config, error } = parse(d);
  const changed =
    config !== null && JSON.stringify(config) !== JSON.stringify(saved);
  const patch = (p: Partial<Draft>) => setDraft({ ...d, ...p });
  const symbol = currencySymbol();

  // مثال حيّ بسعر صنف 100 ج.
  const sample = 10_000;
  const example = config
    ? splitLine(
        sample,
        toBasisPoints(config.defaultRate),
        taxMode({ ...config, enabled: true }),
      )
    : null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!config || !changed) return;
    save.mutate(config, { onSuccess: () => setDraft(null) });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="tax-enabled" className="flex-1">
          المحل مسجل في ضريبة القيمة المضافة
        </Label>
        <Switch
          id="tax-enabled"
          checked={d.enabled}
          onCheckedChange={(enabled) => patch({ enabled })}
        />
      </div>

      <div className={cn("space-y-4", !d.enabled && "opacity-60")}>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
          {MODES.map((m) => {
            const active = d.pricesIncludeTax === m.include;
            return (
              <button
                key={m.title}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => patch({ pricesIncludeTax: m.include })}
                className={cn(
                  "space-y-1 border p-3 text-start transition-colors",
                  active ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                )}
              >
                <span className="block text-sm font-medium">{m.title}</span>
                <span className="block text-xs leading-relaxed text-muted-foreground">
                  {m.hint}
                </span>
              </button>
            );
          })}
        </div>

        <div className="max-w-48 space-y-1.5">
          <Label htmlFor="tax-rate">النسبة الافتراضية للأصناف</Label>
          <div className="relative">
            <Input
              id="tax-rate"
              inputMode="decimal"
              value={d.defaultRate}
              onChange={(e) => patch({ defaultRate: e.target.value })}
              aria-invalid={Boolean(error)}
              className="h-10 pe-8 font-mono"
            />
            <span className="pointer-events-none absolute inset-y-0 inset-e-3 flex items-center text-sm text-muted-foreground">
              %
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            للأصناف الجديدة. نسبة كل صنف (أو إعفاؤه) تُعدَّل من شاشة الصنف.
          </p>
        </div>

        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : (
          example && (
            <div className="flex gap-3 bg-muted/50 p-3 text-sm">
              <IconInfoCircle className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <p className="leading-relaxed">
                صنف سعره <Num>100</Num> {symbol}: الصافي{" "}
                <Num>{formatNumber(example[0] / 100)}</Num> + ضريبة{" "}
                <Num>{formatNumber(example[1] / 100)}</Num> = يدفع العميل{" "}
                <Num>{formatNumber(example[2] / 100)}</Num> {symbol}.
              </p>
            </div>
          )
        )}
        <p className="text-xs text-muted-foreground">
          التغيير يسري على الفواتير الجديدة فقط. الفواتير السابقة تحتفظ بضريبتها
          وقت البيع، والمرتجع يُحسب بها.
        </p>
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
