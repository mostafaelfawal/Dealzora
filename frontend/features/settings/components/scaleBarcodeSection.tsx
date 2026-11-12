"use client";

import {
  IconCircleCheck,
  IconCircleX,
  IconDeviceFloppy,
  IconFileExport,
  IconLoader2,
} from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Num } from "@/components/shared/Num";
import { OptionSelect } from "@/components/shared/OptionSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { fetchAllProducts } from "@/features/purchases/api/purchases.api";
import { extractErrorMessage } from "@/lib/errors";
import { toastFileSaved } from "@/lib/fileToast";
import { formatMoneyText, formatQty, normalizeDigits } from "@/lib/format";
import { saveFile } from "@/lib/saveFile";
import {
  formatPrefixes,
  parsePrefixes,
  parseScaleBarcode,
  scaleConfigError,
  useScaleConfig,
  withCheckDigit,
  type ScaleBarcodeConfig,
  type ScaleMode,
} from "@/lib/scaleBarcode";
import { cn } from "@/lib/utils";

import { useSaveScaleBarcode } from "../hooks/useSettings";

const lengths = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({
    value: String(from + i),
    label: `${from + i} خانات`,
  }));

const MODES: { value: ScaleMode; label: string }[] = [
  { value: "weight", label: "الوزن" },
  { value: "price", label: "السعر" },
];

const DECIMALS: Record<ScaleMode, { value: string; label: string }[]> = {
  weight: [
    { value: "3", label: "جرام (01250 = 1.250 كجم)" },
    { value: "2", label: "10 جرام (00125 = 1.25 كجم)" },
    { value: "0", label: "كيلو صحيح" },
  ],
  price: [
    { value: "2", label: "قروش (01250 = 12.50)" },
    { value: "1", label: "عُشر (01250 = 125.0)" },
    { value: "0", label: "بدون كسور (01250 = 1250)" },
  ],
};

/** شكل الملصق: كل خانة ملوّنة بدورها (بادئة/كود/قيمة/تحقق). */
function BarcodeLayout({ cfg }: { cfg: ScaleBarcodeConfig }) {
  const plen = cfg.prefixes[0]?.length ?? 2;
  const parts = [
    { label: "بادئة", n: plen, cls: "bg-muted text-muted-foreground" },
    {
      label: "كود الصنف",
      n: cfg.codeLength,
      cls: "bg-primary/15 text-primary",
    },
    {
      label: cfg.mode === "weight" ? "الوزن" : "السعر",
      n: cfg.valueLength,
      cls: "bg-success/15 text-success",
    },
    {
      label: "",
      n: Math.max(12 - plen - cfg.codeLength - cfg.valueLength, 0),
      cls: "bg-muted/50 text-muted-foreground",
    },
    { label: "تحقق", n: 1, cls: "bg-warning/15 text-warning" },
  ].filter((p) => p.n > 0);
  return (
    <div dir="ltr" className="flex gap-0.5 overflow-x-auto font-mono text-xs">
      {parts.map((p, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <div className="flex gap-0.5">
            {Array.from({ length: p.n }, (_, j) => (
              <span
                key={j}
                className={cn(
                  "flex h-7 w-5 items-center justify-center",
                  p.cls,
                )}
              >
                {p.label === "بادئة"
                  ? (cfg.prefixes[0]?.[j] ?? "2")
                  : p.label === "تحقق"
                    ? "✓"
                    : p.label
                      ? "•"
                      : "×"}
              </span>
            ))}
          </div>
          <span dir="rtl" className="text-[10px] text-muted-foreground">
            {p.label || "تُتجاهل"}
          </span>
        </div>
      ))}
    </div>
  );
}

/** مثال ملصق صالح بالإعداد الحالي: الصنف 1234 بوزن 1.250 (أو سعر 12.50). */
function sampleCode(cfg: ScaleBarcodeConfig): string | null {
  if (scaleConfigError(cfg)) return null;
  const value = cfg.mode === "weight" ? 1.25 : 12.5;
  const raw = Math.round(value * 10 ** cfg.valueDecimals);
  const body = (
    cfg.prefixes[0] +
    "1234".padStart(cfg.codeLength, "0") +
    String(raw).padStart(cfg.valueLength, "0")
  ).padEnd(12, "0");
  return body.length === 12 ? withCheckDigit(body) : null;
}

function ScaleTester({ cfg }: { cfg: ScaleBarcodeConfig }) {
  const [code, setCode] = useState("");
  const clean = normalizeDigits(code).trim();
  const read = clean
    ? parseScaleBarcode(clean, { ...cfg, enabled: true })
    : null;
  const sample = sampleCode(cfg);

  return (
    <div className="space-y-2 border bg-muted/30 p-3">
      <Label htmlFor="scale-test">جرّب ملصقاً</Label>
      <Input
        id="scale-test"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder={sample ?? "امسح ملصقاً من الميزان"}
        inputMode="numeric"
        dir="ltr"
        autoComplete="off"
        className="h-10 font-mono"
      />
      {clean ? (
        read ? (
          <p className="flex items-center gap-1.5 text-sm text-success">
            <IconCircleCheck className="size-4 shrink-0" />
            <span>
              كود الصنف <Num>{read.scaleCode}</Num> ·{" "}
              {read.weight !== null ? (
                <>
                  الوزن <Num>{formatQty(read.weight)}</Num>
                </>
              ) : (
                <>السعر {formatMoneyText(read.amount ?? 0)}</>
              )}
            </span>
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-sm text-destructive">
            <IconCircleX className="size-4 shrink-0" />
            لا يطابق الصيغة (13 رقماً تبدأ بإحدى البادئات
            {cfg.checkDigit ? " ورقم تحقق صحيح" : ""}).
          </p>
        )
      ) : (
        sample && (
          <p className="text-[11px] text-muted-foreground">
            مثال بهذه الصيغة: <Num>{sample}</Num> = الصنف 1234،{" "}
            {cfg.mode === "weight" ? "وزن 1.250" : "سعر 12.50"}
          </p>
        )
      )}
    </div>
  );
}

/** ملف CSV بأصناف الميزان (الكود، الاسم، السعر) لإدخالها في برنامج الميزان. */
function useExportPlu() {
  return useMutation({
    mutationFn: async () => {
      const items = (await fetchAllProducts()).filter(
        (p) => p.scaleCode !== null && p.isActive,
      );
      if (!items.length) return null;
      const esc = (t: string) => `"${t.replace(/"/g, '""')}"`;
      const rows = [
        "PLU,Name,Price,Unit",
        ...items
          .sort((a, b) => (a.scaleCode ?? 0) - (b.scaleCode ?? 0))
          .map((p) =>
            [
              p.scaleCode,
              esc(p.name),
              p.salePrice.toFixed(2),
              esc(p.unit),
            ].join(","),
          ),
      ];
      // BOM: Excel وبرامج الموازين يقرأون العربي صحيحاً.
      const bytes = new TextEncoder().encode("﻿" + rows.join("\r\n"));
      return {
        count: items.length,
        file: await saveFile(bytes, "scale-plu.csv", "text/csv"),
      };
    },
    onSuccess: (result) => {
      if (!result) {
        toast.info("لا توجد أصناف لها كود ميزان", {
          description: "أضف «كود الميزان» للأصناف الموزونة من شاشة الأصناف.",
        });
        return;
      }
      toastFileSaved({
        title: "تم تصدير أصناف الميزان",
        detail: `${result.count} صنف`,
        file: result.file,
      });
    },
    onError: (e) =>
      toast.error(extractErrorMessage(e, "تعذّر تصدير أصناف الميزان")),
  });
}

/** صيغة ملصق الميزان + تجربة فورية + تصدير الأصناف لبرنامج الميزان. */
export function ScaleBarcodeSection() {
  const saved = useScaleConfig();
  const save = useSaveScaleBarcode();
  const exportPlu = useExportPlu();
  const [draft, setDraft] = useState<ScaleBarcodeConfig | null>(null);
  const [prefixText, setPrefixText] = useState<string | null>(null);

  const cfg = draft ?? saved;
  const prefixes = prefixText ?? formatPrefixes(cfg.prefixes);
  const error = scaleConfigError(cfg);
  const changed = JSON.stringify(cfg) !== JSON.stringify(saved);
  const patch = (p: Partial<ScaleBarcodeConfig>) => setDraft({ ...cfg, ...p });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (error || !changed) return;
    save.mutate(cfg, {
      onSuccess: () => {
        setDraft(null);
        setPrefixText(null);
      },
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="scale-enabled" className="flex-1">
          قراءة ملصقات الميزان في الكاشير
        </Label>
        <Switch
          id="scale-enabled"
          checked={cfg.enabled}
          onCheckedChange={(enabled) => patch({ enabled })}
        />
      </div>

      <div className={cn("space-y-4", !cfg.enabled && "opacity-60")}>
        <BarcodeLayout cfg={cfg} />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="scale-prefixes">البادئات</Label>
            <Input
              id="scale-prefixes"
              value={prefixes}
              dir="ltr"
              onChange={(e) => {
                setPrefixText(e.target.value);
                patch({
                  prefixes: parsePrefixes(normalizeDigits(e.target.value)),
                });
              }}
              placeholder="20-29"
              className="h-10 font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              مثل 20-29 أو 21, 22 (أول خانات الملصق)
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>طول كود الصنف</Label>
            <OptionSelect
              label="طول كود الصنف"
              items={lengths(3, 6)}
              value={String(cfg.codeLength)}
              onChange={(v) => patch({ codeLength: Number(v) })}
              className="w-full"
            />
          </div>
          <div className="space-y-1.5">
            <Label>الملصق يحمل</Label>
            <OptionSelect
              label="الملصق يحمل"
              items={MODES}
              value={cfg.mode}
              onChange={(mode) =>
                patch({ mode, valueDecimals: mode === "weight" ? 3 : 2 })
              }
              className="w-full"
            />
          </div>
          <div className="space-y-1.5">
            <Label>طول {cfg.mode === "weight" ? "الوزن" : "السعر"}</Label>
            <OptionSelect
              label="طول القيمة"
              items={lengths(4, 6)}
              value={String(cfg.valueLength)}
              onChange={(v) => patch({ valueLength: Number(v) })}
              className="w-full"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{cfg.mode === "weight" ? "وحدة الوزن" : "كسور السعر"}</Label>
            <OptionSelect
              label="الكسور"
              items={DECIMALS[cfg.mode]}
              value={String(cfg.valueDecimals)}
              onChange={(v) => patch({ valueDecimals: Number(v) })}
              className="w-full"
            />
          </div>
          <label className="flex items-center gap-2 self-end border p-2.5 text-sm">
            <Switch
              checked={cfg.checkDigit}
              onCheckedChange={(checkDigit) => patch({ checkDigit })}
            />
            التحقق من رقم EAN الأخير
          </label>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}
        {cfg.mode === "price" && (
          <p className="text-xs text-muted-foreground">
            في وضع السعر: الكمية = قيمة الملصق ÷ سعر الكيلو في البرنامج. لو
            اختلف سعر الميزان عن البرنامج تختلف الكمية، فوحّد الأسعار.
          </p>
        )}

        <ScaleTester cfg={cfg} />
      </div>

      <div className="flex flex-wrap justify-between gap-2 border-t pt-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={exportPlu.isPending}
          onClick={() => exportPlu.mutate()}
          className="h-10 gap-2 font-normal"
        >
          {exportPlu.isPending ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconFileExport className="size-4" />
          )}
          تصدير أصناف الميزان (CSV)
        </Button>
        <Button
          type="submit"
          size="lg"
          disabled={Boolean(error) || !changed || save.isPending}
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
