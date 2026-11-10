"use client";

import { IconDeviceFloppy, IconLoader2 } from "@tabler/icons-react";
import { useState, type FormEvent } from "react";

import { OptionSelect } from "@/components/shared/OptionSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrency, type Currency } from "@/lib/currency";
import { formatNumber } from "@/lib/format";

import {
  ARAB_CURRENCIES,
  CURRENCY_LIMITS,
  OTHER_CURRENCY,
} from "../config/currencies";
import { useSaveCurrency } from "../hooks/useSettings";

const ITEMS = [
  ...ARAB_CURRENCIES.map((c) => ({
    value: c.code,
    label: `${c.country} — ${c.name} (${c.symbol})`,
  })),
  { value: OTHER_CURRENCY, label: "أخرى (أكتبها بنفسي)" },
];

const SAMPLE = 1250;

/** عملة المحل: تظهر في كل الأسعار والفواتير والتقارير. محفوظة في القاعدة للجميع. */
export function CurrencySection() {
  const saved = useCurrency();
  const save = useSaveCurrency();

  const savedIsListed = ARAB_CURRENCIES.some((c) => c.code === saved.code);
  const [choice, setChoice] = useState<string | null>(null);
  const [custom, setCustom] = useState<Currency | null>(null);

  const selected = choice ?? (savedIsListed ? saved.code : OTHER_CURRENCY);
  const isOther = selected === OTHER_CURRENCY;
  const customValue =
    custom ?? (savedIsListed ? { code: "", symbol: "", name: "" } : saved);

  const next: Currency | null = isOther
    ? customValue.name.trim() &&
      customValue.symbol.trim() &&
      customValue.code.trim()
      ? {
          code: customValue.code.trim().toUpperCase(),
          symbol: customValue.symbol.trim(),
          name: customValue.name.trim(),
        }
      : null
    : (ARAB_CURRENCIES.find((c) => c.code === selected) ?? null);

  const changed =
    !!next &&
    (next.code !== saved.code ||
      next.symbol !== saved.symbol ||
      next.name !== saved.name);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!next || !changed) return;
    save.mutate(
      { code: next.code, symbol: next.symbol, name: next.name },
      {
        onSuccess: () => {
          setChoice(null);
          setCustom(null);
        },
      },
    );
  }

  const patch = (p: Partial<Currency>) => setCustom({ ...customValue, ...p });

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label>العملة</Label>
        <OptionSelect
          label="العملة"
          items={ITEMS}
          value={selected}
          onChange={setChoice}
          className="w-full"
        />
      </div>

      {isOther && (
        <div className="grid gap-2 sm:grid-cols-[1fr_7rem_7rem]">
          <div className="space-y-1.5">
            <Label htmlFor="cur-name">اسم العملة</Label>
            <Input
              id="cur-name"
              value={customValue.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="مثال: دولار أمريكي"
              maxLength={CURRENCY_LIMITS.name}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cur-symbol">الاختصار</Label>
            <Input
              id="cur-symbol"
              value={customValue.symbol}
              onChange={(e) => patch({ symbol: e.target.value })}
              placeholder="$"
              maxLength={CURRENCY_LIMITS.symbol}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cur-code">الرمز الدولي</Label>
            <Input
              id="cur-code"
              dir="ltr"
              value={customValue.code}
              onChange={(e) => patch({ code: e.target.value })}
              placeholder="USD"
              maxLength={CURRENCY_LIMITS.code}
              className="font-mono uppercase"
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <p className="text-xs text-muted-foreground">
          شكل المبالغ:{" "}
          <bdi className="font-medium text-foreground">
            <span dir="ltr" className="font-mono">
              {formatNumber(SAMPLE)}
            </span>{" "}
            {next?.symbol || saved.symbol}
          </bdi>
        </p>
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
          حفظ العملة
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        تغيير العملة يغيّر الرمز المعروض فقط ولا يحوّل الأسعار المسجّلة.
      </p>
    </form>
  );
}
