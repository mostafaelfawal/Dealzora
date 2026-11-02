"use client";

import {
  IconBarcode,
  IconPlus,
  IconSparkles,
  IconTrash,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useHotkey } from "@/hooks/useHotkey";
import { cn } from "@/lib/utils";

import {
  BASE_UNITS,
  DECIMAL_UNITS,
  EXTRA_UNIT_PRESETS,
  MARKUP_PRESETS,
  MAX_EXTRA_UNITS,
} from "../config/productOptions";
import { PRODUCT_ROUTES } from "../config/productRoutes";
import { PRODUCT_FORM_SHORTCUTS } from "../config/productShortcuts";
import {
  calcMargin,
  generateBarcode,
  newLocalId,
  numberOrZero,
  parseNumber,
  suggestSalePrice,
} from "../lib/productCalc";
import {
  emptyValues,
  FIELD_ORDER,
  toFormValues,
  validateProduct,
  type FormErrors,
  type FormField,
} from "../lib/productForm";
import { PRODUCT_CATEGORIES } from "../mocks/productsData";
import type { Product, ProductFormValues, UnitFormRow } from "../types/product";
import { ProductMarginBadge } from "./productMarginBadge";

const NO_CATEGORY = "none";

const CATEGORY_ITEMS = [
  { value: NO_CATEGORY, label: "بدون قسم" },
  ...PRODUCT_CATEGORIES.map((c) => ({ value: c.id, label: c.label })),
];

const UNIT_ITEMS = BASE_UNITS.map((u) => ({ value: u, label: u }));

const FIELD_IDS: Record<FormField, string> = {
  name: "pf-name",
  barcode: "pf-barcode",
  costPrice: "pf-cost",
  salePrice: "pf-sale",
  minStock: "pf-min",
  openingStock: "pf-opening",
  units: "pf-units-name-0",
};

function focusField(field: FormField) {
  document.getElementById(FIELD_IDS[field])?.focus();
}

/** المسؤول عن عرض الخطأ تحت الحقل. */
function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

interface ProductFormProps {
  /** بدون صنف = إضافة، ومعه صنف = تعديل. */
  product?: Product;
}

/**
 * فورم إضافة/تعديل صنف.
 * TODO: الحفظ حالياً وهمي؛ يُستبدل بالكتابة في IndexedDB + الـ outbox.
 */
export function ProductForm({ product }: ProductFormProps) {
  const router = useRouter();
  const isEditing = Boolean(product);

  const [values, setValues] = useState<ProductFormValues>(() =>
    toFormValues(product),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  function patch(partial: Partial<ProductFormValues>) {
    setValues((current) => ({ ...current, ...partial }));
  }

  /** نمسح خطأ الحقل بمجرد ما المستخدم يعدّله. */
  function edit<K extends keyof ProductFormValues>(
    key: K,
    value: ProductFormValues[K],
    field?: FormField,
  ) {
    patch({ [key]: value } as Partial<ProductFormValues>);
    if (field && errors[field]) {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
  }

  function changeUnit(unit: string) {
    patch({
      unit,
      // الوحدات اللي بتقبل كسور بنفعّلها تلقائياً.
      allowDecimal: DECIMAL_UNITS.has(unit) ? true : values.allowDecimal,
    });
  }

  /* ---------- الوحدات الإضافية ---------- */
  function addUnit(name = "") {
    if (values.extraUnits.length >= MAX_EXTRA_UNITS) return;
    const row: UnitFormRow = {
      id: newLocalId(),
      name,
      factor: "",
      barcode: "",
      salePrice: "",
    };
    patch({ extraUnits: [...values.extraUnits, row] });
    if (errors.units) setErrors((c) => ({ ...c, units: undefined }));
  }

  function updateUnit(id: string, partial: Partial<UnitFormRow>) {
    patch({
      extraUnits: values.extraUnits.map((u) =>
        u.id === id ? { ...u, ...partial } : u,
      ),
    });
    if (errors.units) setErrors((c) => ({ ...c, units: undefined }));
  }

  function removeUnit(id: string) {
    patch({ extraUnits: values.extraUnits.filter((u) => u.id !== id) });
  }

  /* ---------- الأسعار ---------- */
  const cost = numberOrZero(parseNumber(values.costPrice));
  const sale = numberOrZero(parseNumber(values.salePrice));
  const margin = calcMargin(cost, sale);

  function applyMarkup(percent: number) {
    if (!(cost > 0)) {
      toast.info("اكتب سعر الشراء أولاً");
      focusField("costPrice");
      return;
    }
    edit("salePrice", String(suggestSalePrice(cost, percent)), "salePrice");
  }

  /* ---------- الحفظ ---------- */
  function submit(andNew: boolean) {
    if (saving) return;

    const found = validateProduct(values, product?.id);
    setErrors(found);

    const firstError = FIELD_ORDER.find((field) => found[field]);
    if (firstError) {
      focusField(firstError);
      toast.error("راجع الحقول المطلوبة");
      return;
    }

    setSaving(true);
    // TODO: اكتب في قاعدة البيانات المحلية + الـ outbox بدل التأخير الوهمي.
    window.setTimeout(() => {
      toast.success(isEditing ? "تم حفظ التعديلات" : "تمت إضافة الصنف", {
        description: values.name.trim(),
      });
      setSaving(false);

      if (andNew) {
        setValues(emptyValues());
        setErrors({});
        focusField("name");
      } else {
        router.push(PRODUCT_ROUTES.list);
      }
    }, 400);
  }

  useHotkey(PRODUCT_FORM_SHORTCUTS.save.match, () => submit(false));
  useHotkey(PRODUCT_FORM_SHORTCUTS.saveAndNew.match, () => submit(true));

  const invalid = (field: FormField) => Boolean(errors[field]);

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit(false);
      }}
      className="mx-auto flex max-w-3xl flex-col gap-5"
    >
      <header className="space-y-1">
        <h1 className="text-lg font-bold">
          {isEditing ? "تعديل صنف" : "صنف جديد"}
        </h1>
        <p className="text-xs text-muted-foreground">
          {isEditing
            ? "عدّل بيانات الصنف ثم احفظ."
            : "اسم الصنف وسعر البيع فقط هما المطلوبان."}
        </p>
      </header>

      {/* ---------- البيانات الأساسية ---------- */}
      <section className="space-y-4 border bg-card p-4">
        <h2 className="text-sm font-semibold">البيانات الأساسية</h2>

        <div className="space-y-1.5">
          <Label htmlFor="pf-name">اسم الصنف *</Label>
          <Input
            id="pf-name"
            value={values.name}
            onChange={(event) => edit("name", event.target.value, "name")}
            aria-invalid={invalid("name")}
            aria-describedby="pf-name-error"
            autoComplete="off"
            autoFocus={!isEditing}
            placeholder="مثال: أرز مصري 1 كجم"
          />
          <FieldError id="pf-name-error" message={errors.name} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pf-barcode">الباركود</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <IconBarcode
                aria-hidden
                className="pointer-events-none absolute inset-s-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="pf-barcode"
                value={values.barcode}
                onChange={(event) =>
                  edit("barcode", event.target.value, "barcode")
                }
                aria-invalid={invalid("barcode")}
                aria-describedby="pf-barcode-error"
                autoComplete="off"
                inputMode="numeric"
                placeholder="امسح الباركود أو اكتبه"
                className="ps-8 font-mono"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => edit("barcode", generateBarcode(), "barcode")}
              className="gap-2 font-normal"
            >
              <IconSparkles className="size-4" />
              توليد
            </Button>
          </div>
          <FieldError id="pf-barcode-error" message={errors.barcode} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pf-category">القسم</Label>
            <Select
              items={CATEGORY_ITEMS}
              value={values.category || NO_CATEGORY}
              onValueChange={(next) => {
                if (next) patch({ category: next === NO_CATEGORY ? "" : next });
              }}
            >
              <SelectTrigger id="pf-category" className="w-full">
                <SelectValue className="text-start" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {CATEGORY_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pf-unit">وحدة البيع الأساسية</Label>
            <Select
              items={UNIT_ITEMS}
              value={values.unit}
              onValueChange={(next) => {
                if (next) changeUnit(next);
              }}
            >
              <SelectTrigger id="pf-unit" className="w-full">
                <SelectValue className="text-start" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {UNIT_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t pt-3">
          <div className="space-y-0.5">
            <Label htmlFor="pf-decimal">يُباع بالوزن أو بكسور</Label>
            <p className="text-xs text-muted-foreground">
              مثل 0.5 كجم أو 1.25 متر.
            </p>
          </div>
          <Switch
            id="pf-decimal"
            checked={values.allowDecimal}
            onCheckedChange={(checked) => patch({ allowDecimal: checked })}
          />
        </div>
      </section>

      {/* ---------- الأسعار ---------- */}
      <section className="space-y-4 border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">الأسعار</h2>
          {margin && <ProductMarginBadge cost={cost} sale={sale} />}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pf-cost">سعر الشراء</Label>
            <Input
              id="pf-cost"
              dir="ltr"
              inputMode="decimal"
              value={values.costPrice}
              onChange={(event) =>
                edit("costPrice", event.target.value, "costPrice")
              }
              aria-invalid={invalid("costPrice")}
              aria-describedby="pf-cost-error"
              autoComplete="off"
              placeholder="0"
              className="font-mono"
            />
            <FieldError id="pf-cost-error" message={errors.costPrice} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pf-sale">سعر البيع *</Label>
            <Input
              id="pf-sale"
              dir="ltr"
              inputMode="decimal"
              value={values.salePrice}
              onChange={(event) =>
                edit("salePrice", event.target.value, "salePrice")
              }
              aria-invalid={invalid("salePrice")}
              aria-describedby="pf-sale-error"
              autoComplete="off"
              placeholder="0"
              className="font-mono"
            />
            <FieldError id="pf-sale-error" message={errors.salePrice} />
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">
            اقترح سعر البيع من سعر الشراء + نسبة ربح:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {MARKUP_PRESETS.map((percent) => (
              <Button
                key={percent}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => applyMarkup(percent)}
                className="font-normal"
              >
                +
                <bdi dir="ltr" className="font-mono">
                  {percent}%
                </bdi>
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- المخزون ---------- */}
      <section className="space-y-4 border bg-card p-4">
        <h2 className="text-sm font-semibold">المخزون</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pf-min">الحد الأدنى للتنبيه</Label>
            <Input
              id="pf-min"
              dir="ltr"
              inputMode="decimal"
              value={values.minStock}
              onChange={(event) =>
                edit("minStock", event.target.value, "minStock")
              }
              aria-invalid={invalid("minStock")}
              aria-describedby="pf-min-error"
              autoComplete="off"
              placeholder="0"
              className="font-mono"
            />
            <FieldError id="pf-min-error" message={errors.minStock} />
          </div>

          {!isEditing && (
            <div className="space-y-1.5">
              <Label htmlFor="pf-opening">الرصيد الافتتاحي</Label>
              <Input
                id="pf-opening"
                dir="ltr"
                inputMode="decimal"
                value={values.openingStock}
                onChange={(event) =>
                  edit("openingStock", event.target.value, "openingStock")
                }
                aria-invalid={invalid("openingStock")}
                aria-describedby="pf-opening-error"
                autoComplete="off"
                placeholder="0"
                className="font-mono"
              />
              <FieldError id="pf-opening-error" message={errors.openingStock} />
            </div>
          )}
        </div>

        {isEditing && (
          <p className="text-xs text-muted-foreground">
            الرصيد الحالي يتغيّر من حركات الشراء والبيع والجرد، وليس من هنا.
          </p>
        )}
      </section>

      {/* ---------- وحدات إضافية ---------- */}
      <section className="space-y-3 border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold">وحدات بيع إضافية</h2>
            <p className="text-xs text-muted-foreground">
              مثل الكرتونة أو الدستة. المخزون يُحسب دائماً بالوحدة الأساسية.
            </p>
          </div>
        </div>

        {values.extraUnits.length > 0 && (
          <ul className="space-y-2">
            {values.extraUnits.map((unit, index) => (
              <li
                key={unit.id}
                className="grid grid-cols-2 gap-2 border p-2.5 sm:grid-cols-[1fr_5rem_1fr_6rem_auto]"
              >
                <Input
                  id={`pf-units-name-${index}`}
                  aria-label="اسم الوحدة"
                  value={unit.name}
                  onChange={(event) =>
                    updateUnit(unit.id, { name: event.target.value })
                  }
                  placeholder="الاسم"
                />
                <Input
                  aria-label={`عدد ${values.unit} في الوحدة`}
                  dir="ltr"
                  inputMode="decimal"
                  value={unit.factor}
                  onChange={(event) =>
                    updateUnit(unit.id, { factor: event.target.value })
                  }
                  placeholder="العدد"
                  className="font-mono"
                />
                <Input
                  aria-label="باركود الوحدة"
                  dir="ltr"
                  value={unit.barcode}
                  onChange={(event) =>
                    updateUnit(unit.id, { barcode: event.target.value })
                  }
                  placeholder="الباركود"
                  className="font-mono"
                />
                <Input
                  aria-label="سعر بيع الوحدة"
                  dir="ltr"
                  inputMode="decimal"
                  value={unit.salePrice}
                  onChange={(event) =>
                    updateUnit(unit.id, { salePrice: event.target.value })
                  }
                  placeholder="السعر"
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`حذف الوحدة ${unit.name || ""}`}
                  onClick={() => removeUnit(unit.id)}
                  className="text-destructive"
                >
                  <IconTrash />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <FieldError id="pf-units-error" message={errors.units} />

        {values.extraUnits.length < MAX_EXTRA_UNITS && (
          <div className="flex flex-wrap gap-1.5">
            {EXTRA_UNIT_PRESETS.map((preset) => (
              <Button
                key={preset}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => addUnit(preset)}
                className="gap-1 font-normal"
              >
                <IconPlus className="size-3.5" />
                {preset}
              </Button>
            ))}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => addUnit()}
              className="gap-1 font-normal"
            >
              <IconPlus className="size-3.5" />
              وحدة أخرى
            </Button>
          </div>
        )}
      </section>

      {/* ---------- الحالة ---------- */}
      <section className="flex items-center justify-between gap-3 border bg-card p-4">
        <div className="space-y-0.5">
          <Label htmlFor="pf-active">مفعّل في الكاشير</Label>
          <p className="text-xs text-muted-foreground">
            الصنف المعطّل لا يظهر في شاشة البيع.
          </p>
        </div>
        <Switch
          id="pf-active"
          checked={values.isActive}
          onCheckedChange={(checked) => patch({ isActive: checked })}
        />
      </section>

      {/* ---------- الأزرار ---------- */}
      <div
        className={cn(
          "sticky bottom-0 -mx-1 flex flex-col-reverse gap-2 border-t bg-background/95 px-1 py-3 backdrop-blur sm:flex-row sm:justify-end",
        )}
      >
        <Button
          type="button"
          variant="outline"
          size="lg"
          nativeButton={false}
          render={<Link href={PRODUCT_ROUTES.list} />}
          className="font-normal sm:me-auto"
        >
          إلغاء
        </Button>
        {!isEditing && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={saving}
            onClick={() => submit(true)}
            className="gap-2 font-normal"
          >
            حفظ وإضافة آخر
            <ShortcutBadge className="hidden lg:inline-flex">
              {PRODUCT_FORM_SHORTCUTS.saveAndNew.label}
            </ShortcutBadge>
          </Button>
        )}
        <Button
          type="submit"
          size="lg"
          disabled={saving}
          className="gap-2 px-5"
        >
          {isEditing ? "حفظ التعديلات" : "حفظ الصنف"}
          <ShortcutBadge className="hidden border-primary-foreground/30 text-primary-foreground/80 lg:inline-flex">
            {PRODUCT_FORM_SHORTCUTS.save.label}
          </ShortcutBadge>
        </Button>
      </div>
    </form>
  );
}
