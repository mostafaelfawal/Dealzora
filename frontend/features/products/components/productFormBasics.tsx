"use client";

import {
  IconBarcode,
  IconScale,
  IconSettings,
  IconSparkles,
} from "@tabler/icons-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useWatch } from "react-hook-form";

import {
  errorId,
  FormField,
  FormSection,
  SwitchField,
} from "@/components/shared/form";
import { AppTooltip } from "@/components/shared/AppTooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CatalogDialog } from "@/features/catalog/components/catalogDialog";
import { useUnits } from "@/features/catalog/hooks/useCatalog";
import type { CatalogTab } from "@/features/catalog/types/catalog";
import { useScaleConfig } from "@/lib/scaleBarcode";

import {
  NO_CATEGORY,
  PRODUCT_FIELD_IDS as IDS,
} from "../config/productFormFields";
import useGetCategories from "../hooks/useGetCategories";
import { useProductFormFields } from "../hooks/useProductFormFields";
import { generateBarcode } from "../lib/productCalc";

type Item = { value: string; label: string };

/** قائمة اختيار بعرض كامل مربوطة بـ Label عبر id. */
function FieldSelect({
  id,
  items,
  value,
  onChange,
}: {
  id: string;
  items: Item[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next);
      }}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue className="text-start" />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** زر صغير بجانب القائمة يفتح إدارة الأقسام/الوحدات. */
function ManageButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <AppTooltip message={label}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={label}
        onClick={onClick}
        className="shrink-0"
      >
        <IconSettings />
      </Button>
    </AppTooltip>
  );
}

export function ProductFormBasics() {
  const { form, setField, isEditing } = useProductFormFields();
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const [category, unit, allowDecimal] = useWatch({
    control,
    name: ["category", "unit", "allowDecimal"],
  });

  const scaleEnabled = useScaleConfig().enabled;
  const { data: categories = [] } = useGetCategories();
  const categoryItems = useMemo<Item[]>(
    () => [
      { value: NO_CATEGORY, label: "بدون قسم" },
      ...categories.map((c) => ({ value: c.id, label: c.label })),
    ],
    [categories],
  );

  const { data: units = [] } = useUnits();
  const unitItems = useMemo<Item[]>(() => {
    const items = units.map((u) => ({ value: u.name, label: u.name }));
    // وحدة قديمة/مستوردة غير موجودة في القائمة تظهر كما هي.
    if (unit && !units.some((u) => u.name === unit)) {
      items.unshift({ value: unit, label: unit });
    }
    return items;
  }, [units, unit]);

  const [catalogTab, setCatalogTab] = useState<CatalogTab | null>(null);

  function changeUnit(next: string) {
    setField("unit", next);
    if (units.find((u) => u.name === next)?.allowDecimal) {
      setField("allowDecimal", true);
    }
  }

  return (
    <FormSection title="البيانات الأساسية">
      <FormField id={IDS.name} label="اسم الصنف *" error={errors.name?.message}>
        <Input
          id={IDS.name}
          {...register("name")}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errorId(IDS.name)}
          autoComplete="off"
          autoFocus={!isEditing}
          placeholder="مثال: أرز مصري 1 كجم"
        />
      </FormField>

      <FormField
        id={IDS.barcode}
        label="الباركود"
        error={errors.barcode?.message}
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <IconBarcode
              aria-hidden
              className="pointer-events-none absolute inset-s-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id={IDS.barcode}
              {...register("barcode")}
              aria-invalid={Boolean(errors.barcode)}
              aria-describedby={errorId(IDS.barcode)}
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
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={IDS.category} label="القسم">
          <div className="flex gap-2">
            <FieldSelect
              id={IDS.category}
              items={categoryItems}
              value={category || NO_CATEGORY}
              onChange={(next) =>
                setField("category", next === NO_CATEGORY ? "" : next)
              }
            />
            <ManageButton
              label="إدارة الأقسام"
              onClick={() => setCatalogTab("categories")}
            />
          </div>
        </FormField>

        <FormField
          id={IDS.unit}
          label="وحدة البيع الأساسية"
          error={errors.unit?.message}
        >
          <div className="flex gap-2">
            <FieldSelect
              id={IDS.unit}
              items={unitItems}
              value={unit}
              onChange={changeUnit}
            />
            <ManageButton
              label="إدارة الوحدات"
              onClick={() => setCatalogTab("units")}
            />
          </div>
        </FormField>
      </div>

      <SwitchField
        id={IDS.allowDecimal}
        label="يُباع بالوزن أو بكسور"
        description="مثل 0.5 كجم أو 1.25 متر."
        checked={allowDecimal}
        onCheckedChange={(checked) => setField("allowDecimal", checked)}
        className="border-t pt-3"
      />

      {allowDecimal && (
        <FormField
          id={IDS.scaleCode}
          label="كود الميزان (PLU)"
          error={errors.scaleCode?.message}
        >
          <div className="relative max-w-60">
            <IconScale
              aria-hidden
              className="pointer-events-none absolute inset-s-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id={IDS.scaleCode}
              {...register("scaleCode")}
              aria-invalid={Boolean(errors.scaleCode)}
              aria-describedby={errorId(IDS.scaleCode)}
              autoComplete="off"
              inputMode="numeric"
              dir="ltr"
              placeholder="مثال: 1234"
              className="ps-8 font-mono"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            نفس رقم الصنف المسجّل على الميزان. الكاشير يقرأ الوزن من الملصق
            مباشرة.{" "}
            {!scaleEnabled && (
              <Link
                href="/admin/settings#scale"
                className="text-primary underline"
              >
                فعّل باركود الميزان من الإعدادات
              </Link>
            )}
          </p>
        </FormField>
      )}

      <CatalogDialog
        open={catalogTab !== null}
        onOpenChange={(open) => !open && setCatalogTab(null)}
        initialTab={catalogTab ?? "categories"}
      />
    </FormSection>
  );
}
