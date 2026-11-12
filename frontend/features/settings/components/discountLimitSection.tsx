"use client";

import { IconDeviceFloppy, IconLoader2 } from "@tabler/icons-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import type { DiscountLimit } from "../api/settings.api";
import { useDiscountLimit, useSaveDiscountLimit } from "../hooks/useSettings";

/** حد خصم الكاشير: تفعيل/إيقاف + النسبة. null = لم يُعدَّل (تُعرض القيمة المحفوظة). */
export function DiscountLimitSection() {
  const saved = useDiscountLimit();
  const save = useSaveDiscountLimit();
  const [draft, setDraft] = useState<{ enabled: boolean; percent: string } | null>(null);

  if (!saved.data) {
    return <p className="text-xs text-muted-foreground">جارِ التحميل…</p>;
  }

  const value = draft ?? {
    enabled: saved.data.enabled,
    percent: String(saved.data.maxPercent),
  };
  const percent = Number(value.percent);
  const valid =
    value.percent.trim() !== "" &&
    Number.isInteger(percent) &&
    percent >= 0 &&
    percent <= 100;
  const next: DiscountLimit = {
    enabled: value.enabled,
    maxPercent: valid ? percent : saved.data.maxPercent,
  };
  const changed =
    next.enabled !== saved.data.enabled ||
    next.maxPercent !== saved.data.maxPercent;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || !changed) return;
    save.mutate(next, { onSuccess: () => setDraft(null) });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="discount-enabled" className="flex-1">
          تحديد أقصى خصم للكاشير
        </Label>
        <Switch
          id="discount-enabled"
          checked={value.enabled}
          onCheckedChange={(checked) =>
            setDraft({ ...value, enabled: checked })
          }
        />
      </div>

      {value.enabled ? (
        <div className="max-w-48 space-y-1.5">
          <Label htmlFor="discount-percent">أقصى نسبة خصم</Label>
          <div className="relative">
            <Input
              id="discount-percent"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              step={1}
              value={value.percent}
              onChange={(e) => setDraft({ ...value, percent: e.target.value })}
              aria-invalid={!valid}
              className="h-10 pe-8 font-mono"
            />
            <span className="pointer-events-none absolute inset-y-0 inset-e-3 flex items-center text-sm text-muted-foreground">
              %
            </span>
          </div>
          {!valid && (
            <p className="text-[11px] text-destructive">
              أدخل رقماً صحيحاً من 0 إلى 100
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          الكاشير يستطيع منح أي خصم بدون حد.
        </p>
      )}

      <div className="flex justify-end border-t pt-3">
        <Button
          type="submit"
          size="lg"
          disabled={!valid || !changed || save.isPending}
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
