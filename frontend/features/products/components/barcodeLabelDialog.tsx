"use client";

import { IconAlertTriangle, IconPrinter } from "@tabler/icons-react";
import { useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import { OptionSelect } from "@/components/shared/OptionSelect";
import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { round2 } from "@/features/pos/lib/posCalc";
import { useShopName } from "@/features/settings/hooks/useSettings";

import {
  getLabelSize,
  LABEL_COPIES_MAX,
  LABEL_SIZES,
  type LabelPrefs,
} from "../config/barcodeLabel";
import { useLabelPrefs } from "../hooks/useLabelPrefs";
import {
  buildLabelsHtml,
  printLabels,
  renderBarcodeSvg,
  type LabelData,
} from "../lib/barcodeLabel";
import type { Product } from "../types/product";

/** الباركودات القابلة للطباعة: الوحدة الأساسية + كل وحدة إضافية لها باركود. */
export function productLabelOptions(product: Product): LabelData[] {
  const options: LabelData[] = [];
  if (product.barcode) {
    options.push({
      name: product.name,
      barcode: product.barcode,
      price: product.salePrice,
    });
  }
  for (const u of product.extraUnits) {
    if (!u.barcode) continue;
    options.push({
      name: product.name,
      barcode: u.barcode,
      unitName: u.name,
      price: u.salePrice ?? round2(product.salePrice * u.factor),
    });
  }
  return options;
}

/** طباعة ملصقات باركود للصنف على طابعة الملصقات (أفقي). */
export function BarcodeLabelDialog({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const copiesRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog open={product !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        initialFocus={copiesRef}
        className="gap-3 sm:max-w-md"
      >
        {product && (
          <LabelForm
            product={product}
            copiesRef={copiesRef}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function LabelForm({
  product,
  copiesRef,
  onClose,
}: {
  product: Product;
  copiesRef: React.RefObject<HTMLInputElement | null>;
  onClose: () => void;
}) {
  const shop = useShopName();
  const shopName = shop.data ?? "";
  const { prefs, patch } = useLabelPrefs();
  const options = useMemo(() => productLabelOptions(product), [product]);
  const [selected, setSelected] = useState(options[0]?.barcode ?? "");
  const [copiesText, setCopiesText] = useState("1");

  const data = options.find((o) => o.barcode === selected) ?? options[0];
  const copies = Number.parseInt(copiesText, 10);

  const printable = useMemo(
    () => !!data && renderBarcodeSvg(data.barcode) !== null,
    [data],
  );
  const copiesOk = copies >= 1 && copies <= LABEL_COPIES_MAX;

  let error: string | null = null;
  if (!data) error = "هذا الصنف ليس له باركود. أضف باركود من شاشة التعديل.";
  else if (!printable) error = "الباركود يحتوي على رموز لا يمكن طباعتها.";
  else if (!copiesOk) error = `عدد النسخ من 1 إلى ${LABEL_COPIES_MAX}.`;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (error || !data) return;
    printLabels(data, prefs, shopName, copies);
    onClose();
  }

  const toggles: { key: keyof Omit<LabelPrefs, "size">; label: string }[] = [
    { key: "showName", label: "اسم الصنف" },
    { key: "showPrice", label: "السعر" },
    { key: "showShop", label: "اسم المحل" },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <DialogHeader className="text-start">
        <DialogTitle>طباعة باركود</DialogTitle>
        <DialogDescription>{product.name}</DialogDescription>
      </DialogHeader>

      {data && printable && (
        <LabelPreview data={data} prefs={prefs} shopName={shopName} />
      )}

      {options.length > 1 && (
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">الوحدة</span>
          <OptionSelect
            label="الوحدة"
            items={options.map((o) => ({
              value: o.barcode,
              label: `${o.unitName ?? product.unit} — ${o.barcode}`,
            }))}
            value={data?.barcode ?? ""}
            onChange={setSelected}
            className="w-full"
          />
        </div>
      )}

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">مقاس الملصق</span>
          <OptionSelect
            label="مقاس الملصق"
            items={LABEL_SIZES}
            value={prefs.size}
            onChange={(size) => patch({ size })}
            className="w-full"
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="label-copies"
            className="text-xs text-muted-foreground"
          >
            عدد النسخ
          </label>
          <Input
            id="label-copies"
            ref={copiesRef}
            dir="ltr"
            inputMode="numeric"
            autoComplete="off"
            value={copiesText}
            onChange={(e) => setCopiesText(e.target.value.replace(/\D/g, ""))}
            onFocus={(e) => e.currentTarget.select()}
            aria-invalid={copiesOk ? undefined : true}
            maxLength={3}
            className="h-10 w-24 text-center font-mono tabular-nums"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t pt-3">
        {toggles.map((t) => (
          <div key={t.key} className="flex items-center gap-2">
            <Switch
              id={`label-${t.key}`}
              checked={prefs[t.key]}
              onCheckedChange={(checked) => patch({ [t.key]: checked })}
            />
            <Label htmlFor={`label-${t.key}`} className="font-normal">
              {t.label}
            </Label>
          </div>
        ))}
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-center gap-2 text-xs text-destructive"
        >
          <IconAlertTriangle className="size-4 shrink-0" />
          {error}
        </p>
      )}

      <p className="text-[11px] text-muted-foreground">
        اختر طابعة الملصقات في نافذة الطباعة، واجعل مقاس الورق في إعداداتها
        مطابقاً لمقاس الملصق.
      </p>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onClose}
          className="gap-2 font-normal"
        >
          رجوع
          <ShortcutBadge className="rounded-none">Esc</ShortcutBadge>
        </Button>
        <Button type="submit" size="lg" disabled={!!error} className="gap-2">
          <IconPrinter />
          طباعة
          <ShortcutBadge className="rounded-none border-primary-foreground/30 text-primary-foreground/80">
            Enter
          </ShortcutBadge>
        </Button>
      </div>
    </form>
  );
}

/** معاينة طبق الأصل: نفس مستند الطباعة داخل iframe مكبّر. */
function LabelPreview({
  data,
  prefs,
  shopName,
}: {
  data: LabelData;
  prefs: LabelPrefs;
  shopName: string;
}) {
  const { width, height } = getLabelSize(prefs.size);
  const html = useMemo(
    () => buildLabelsHtml(data, prefs, shopName, 1),
    [data, prefs, shopName],
  );
  // نكبّر الملصق ليملأ ~240px عرضاً (1mm ≈ 3.78px).
  const scale = 240 / (width * 3.78);

  return (
    <div className="flex justify-center rounded-md bg-muted/60 p-4">
      <div
        style={{ width: `${width * scale}mm`, height: `${height * scale}mm` }}
        className="relative overflow-hidden shadow-sm ring-1 ring-border"
      >
        <iframe
          title="معاينة الملصق"
          srcDoc={html}
          tabIndex={-1}
          style={{
            width: `${width}mm`,
            height: `${height}mm`,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
          className="pointer-events-none absolute top-0 left-0 border-0 bg-white"
        />
      </div>
    </div>
  );
}
