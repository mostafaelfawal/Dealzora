"use client";

import {
  IconBarcode,
  IconDeviceFloppy,
  IconLoader2,
  IconPlus,
  IconSparkles,
  IconTrash,
} from "@tabler/icons-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { FieldErrors, Path, PathValue } from "react-hook-form";
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
import { useProductFormContext } from "../context/ProductFormContext";
import useGetCategories from "../hooks/useGetCategories";
import {
  calcMargin,
  generateBarcode,
  newLocalId,
  numberOrZero,
  parseNumber,
  suggestSalePrice,
} from "../lib/productCalc";
import type {
  ProductSchemaType,
  UnitSchemaType,
} from "../schema/product.schema";
import { ProductMarginBadge } from "./productMarginBadge";

const NO_CATEGORY = "none";

const UNIT_ITEMS = BASE_UNITS.map((u) => ({ value: u, label: u }));

const FIELD_IDS = {
  name: "pf-name",
  barcode: "pf-barcode",
  costPrice: "pf-cost",
  salePrice: "pf-sale",
  minStock: "pf-min",
  openingStock: "pf-opening",
} as const;

type UnitKey = Exclude<keyof UnitSchemaType, "id">;
const UNIT_KEYS: UnitKey[] = ["name", "factor", "barcode", "salePrice"];

const ERROR_ORDER = [
  "name",
  "barcode",
  "costPrice",
  "salePrice",
  "extraUnits",
  "minStock",
  "openingStock",
] as const;

function focusById(id: string) {
  document.getElementById(id)?.focus();
}

function focusFirstError(errors: FieldErrors<ProductSchemaType>) {
  for (const field of ERROR_ORDER) {
    if (!errors[field]) continue;

    if (field === "extraUnits") {
      const rows = errors.extraUnits as unknown as
        | Array<Partial<Record<UnitKey, unknown>> | undefined>
        | undefined;
      const index = Array.isArray(rows) ? rows.findIndex(Boolean) : -1;
      const key =
        index >= 0
          ? (UNIT_KEYS.find((k) => rows?.[index]?.[k]) ?? "name")
          : "name";
      focusById(`pf-unit-${key}-${Math.max(index, 0)}`);
      return;
    }

    focusById(FIELD_IDS[field]);
    return;
  }
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

export function ProductForm() {
  const { form, productId, onSubmit, isSaving } = useProductFormContext();
  const {
    register,
    watch,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitted },
  } = form;
  const [pendingAction, setPendingAction] = useState<"save" | "saveAndNew">(
    "save",
  );
  const isEditing = Boolean(productId);

  const { data: categories = [] } = useGetCategories();
  const categoryItems = useMemo(
    () => [
      { value: NO_CATEGORY, label: "بدون قسم" },
      ...categories.map((c) => ({ value: c.id, label: c.label })),
    ],
    [categories],
  );

  const values = watch();

  function setField<P extends Path<ProductSchemaType>>(
    name: P,
    value: PathValue<ProductSchemaType, P>,
  ) {
    setValue(name, value, { shouldDirty: true, shouldValidate: isSubmitted });
  }

  function changeUnit(unit: string) {
    setField("unit", unit);
    if (DECIMAL_UNITS.has(unit)) setField("allowDecimal", true);
  }

  function addUnit(name = "") {
    if (values.extraUnits.length >= MAX_EXTRA_UNITS) return;
    const row: UnitSchemaType = {
      id: newLocalId(),
      name,
      factor: "",
      barcode: "",
      salePrice: "",
    };
    setField("extraUnits", [...values.extraUnits, row]);
  }

  function updateUnit(index: number, key: UnitKey, value: string) {
    setField(`extraUnits.${index}.${key}`, value);
  }

  function removeUnit(id: string) {
    setField(
      "extraUnits",
      values.extraUnits.filter((u) => u.id !== id),
    );
  }

  const cost = numberOrZero(parseNumber(values.costPrice));
  const sale = numberOrZero(parseNumber(values.salePrice));
  const margin = calcMargin(cost, sale);

  function applyMarkup(percent: number) {
    if (!(cost > 0)) {
      toast.info("اكتب سعر الشراء أولاً");
      focusById(FIELD_IDS.costPrice);
      return;
    }
    setField("salePrice", String(suggestSalePrice(cost, percent)));
  }

  function submit(andNew: boolean) {
    if (isSaving) return;
    setPendingAction(andNew ? "saveAndNew" : "save");
    void handleSubmit(
      (data) => onSubmit(data, andNew),
      (found) => {
        focusFirstError(found);
        toast.error("راجع الحقول المطلوبة");
      },
    )();
  }

  useHotkey(PRODUCT_FORM_SHORTCUTS.save.match, () => submit(false));
  useHotkey(PRODUCT_FORM_SHORTCUTS.saveAndNew.match, () => submit(true));

  const invalid = (field: keyof typeof FIELD_IDS) => Boolean(errors[field]);
  const unitsMessage =
    errors.extraUnits?.root?.message ?? errors.extraUnits?.message;

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

      <section className="space-y-4 border bg-card p-4">
        <h2 className="text-sm font-semibold">البيانات الأساسية</h2>

        <div className="space-y-1.5">
          <Label htmlFor="pf-name">اسم الصنف *</Label>
          <Input
            id="pf-name"
            {...register("name")}
            aria-invalid={invalid("name")}
            aria-describedby="pf-name-error"
            autoComplete="off"
            autoFocus={!isEditing}
            placeholder="مثال: أرز مصري 1 كجم"
          />
          <FieldError id="pf-name-error" message={errors.name?.message} />
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
                {...register("barcode")}
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
              onClick={() => setField("barcode", generateBarcode())}
              className="gap-2 font-normal"
            >
              <IconSparkles className="size-4" />
              توليد
            </Button>
          </div>
          <FieldError id="pf-barcode-error" message={errors.barcode?.message} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pf-category">القسم</Label>
            <Select
              items={categoryItems}
              value={values.category || NO_CATEGORY}
              onValueChange={(next) => {
                if (next)
                  setField("category", next === NO_CATEGORY ? "" : next);
              }}
            >
              <SelectTrigger id="pf-category" className="w-full">
                <SelectValue className="text-start" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {categoryItems.map((item) => (
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
            <FieldError id="pf-unit-error" message={errors.unit?.message} />
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
            onCheckedChange={(checked) => setField("allowDecimal", checked)}
          />
        </div>
      </section>

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
              {...register("costPrice")}
              aria-invalid={invalid("costPrice")}
              aria-describedby="pf-cost-error"
              autoComplete="off"
              placeholder="0"
              className="font-mono"
            />
            <FieldError
              id="pf-cost-error"
              message={errors.costPrice?.message}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pf-sale">سعر البيع *</Label>
            <Input
              id="pf-sale"
              dir="ltr"
              inputMode="decimal"
              {...register("salePrice")}
              aria-invalid={invalid("salePrice")}
              aria-describedby="pf-sale-error"
              autoComplete="off"
              placeholder="0"
              className="font-mono"
            />
            <FieldError
              id="pf-sale-error"
              message={errors.salePrice?.message}
            />
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

      <section className="space-y-4 border bg-card p-4">
        <h2 className="text-sm font-semibold">المخزون</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pf-min">الحد الأدنى للتنبيه</Label>
            <Input
              id="pf-min"
              dir="ltr"
              inputMode="decimal"
              {...register("minStock")}
              aria-invalid={invalid("minStock")}
              aria-describedby="pf-min-error"
              autoComplete="off"
              placeholder="0"
              className="font-mono"
            />
            <FieldError id="pf-min-error" message={errors.minStock?.message} />
          </div>

          {!isEditing && (
            <div className="space-y-1.5">
              <Label htmlFor="pf-opening">الرصيد الافتتاحي</Label>
              <Input
                id="pf-opening"
                dir="ltr"
                inputMode="decimal"
                {...register("openingStock")}
                aria-invalid={invalid("openingStock")}
                aria-describedby="pf-opening-error"
                autoComplete="off"
                placeholder="0"
                className="font-mono"
              />
              <FieldError
                id="pf-opening-error"
                message={errors.openingStock?.message}
              />
            </div>
          )}
        </div>

        {isEditing && (
          <p className="text-xs text-muted-foreground">
            الرصيد الحالي يتغيّر من حركات الشراء والبيع والجرد، وليس من هنا.
          </p>
        )}
      </section>

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
            {values.extraUnits.map((unit, index) => {
              const rowErrors = errors.extraUnits?.[index];
              const rowMessage =
                rowErrors?.name?.message ??
                rowErrors?.factor?.message ??
                rowErrors?.barcode?.message ??
                rowErrors?.salePrice?.message;
              return (
                <li
                  key={unit.id}
                  className="grid grid-cols-2 gap-2 border p-2.5 sm:grid-cols-[1fr_5rem_1fr_6rem_auto]"
                >
                  <Input
                    id={`pf-unit-name-${index}`}
                    aria-label="اسم الوحدة"
                    aria-invalid={Boolean(rowErrors?.name)}
                    value={unit.name}
                    onChange={(event) =>
                      updateUnit(index, "name", event.target.value)
                    }
                    placeholder="الاسم"
                  />
                  <Input
                    id={`pf-unit-factor-${index}`}
                    aria-label={`عدد ${values.unit} في الوحدة`}
                    aria-invalid={Boolean(rowErrors?.factor)}
                    dir="ltr"
                    inputMode="decimal"
                    value={unit.factor}
                    onChange={(event) =>
                      updateUnit(index, "factor", event.target.value)
                    }
                    placeholder="العدد"
                    className="font-mono"
                  />
                  <Input
                    id={`pf-unit-barcode-${index}`}
                    aria-label="باركود الوحدة"
                    aria-invalid={Boolean(rowErrors?.barcode)}
                    dir="ltr"
                    value={unit.barcode}
                    onChange={(event) =>
                      updateUnit(index, "barcode", event.target.value)
                    }
                    placeholder="الباركود"
                    className="font-mono"
                  />
                  <Input
                    id={`pf-unit-salePrice-${index}`}
                    aria-label="سعر بيع الوحدة"
                    aria-invalid={Boolean(rowErrors?.salePrice)}
                    dir="ltr"
                    inputMode="decimal"
                    value={unit.salePrice}
                    onChange={(event) =>
                      updateUnit(index, "salePrice", event.target.value)
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
                  {rowMessage && (
                    <p
                      role="alert"
                      className="col-span-full text-xs text-destructive"
                    >
                      {rowMessage}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <FieldError id="pf-units-error" message={unitsMessage} />

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
          onCheckedChange={(checked) => setField("isActive", checked)}
        />
      </section>
      <div
        className={cn(
          "sticky bottom-0 -mx-1 flex flex-col-reverse gap-2 border-t bg-background/95 px-1 py-3 backdrop-blur sm:flex-row sm:justify-end",
        )}
      >
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={isSaving}
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
            disabled={isSaving}
            aria-busy={isSaving && pendingAction === "saveAndNew"}
            onClick={() => submit(true)}
            className="gap-2 font-normal"
          >
            {isSaving && pendingAction === "saveAndNew" ? (
              <>
                <IconLoader2 className="size-4 animate-spin" aria-hidden />
                جارٍ الحفظ…
              </>
            ) : (
              <>
                حفظ وإضافة آخر
                <ShortcutBadge className="hidden lg:inline-flex">
                  {PRODUCT_FORM_SHORTCUTS.saveAndNew.label}
                </ShortcutBadge>
              </>
            )}
          </Button>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={isSaving}
          aria-busy={isSaving && pendingAction === "save"}
          className="gap-2 px-5"
        >
          {isSaving && pendingAction === "save" ? (
            <>
              <IconLoader2 className="size-4 animate-spin" aria-hidden />
              جارٍ الحفظ…
            </>
          ) : (
            <>
              <IconDeviceFloppy className="size-4" aria-hidden />
              {isEditing ? "حفظ التعديلات" : "حفظ الصنف"}
              <ShortcutBadge className="hidden border-primary-foreground/30 text-primary-foreground/80 lg:inline-flex">
                {PRODUCT_FORM_SHORTCUTS.save.label}
              </ShortcutBadge>
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
