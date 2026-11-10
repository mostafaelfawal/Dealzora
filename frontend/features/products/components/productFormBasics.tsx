"use client";

import { IconBarcode, IconSparkles } from "@tabler/icons-react";
import { useMemo } from "react";
import { useWatch } from "react-hook-form";

import {
  errorId,
  FormField,
  FormSection,
  SwitchField,
} from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  NO_CATEGORY,
  PRODUCT_FIELD_IDS as IDS,
} from "../config/productFormFields";
import { BASE_UNITS, DECIMAL_UNITS } from "../config/productOptions";
import useGetCategories from "../hooks/useGetCategories";
import { useProductFormFields } from "../hooks/useProductFormFields";
import { generateBarcode } from "../lib/productCalc";

const UNIT_ITEMS = BASE_UNITS.map((u) => ({ value: u, label: u }));

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

  const { data: categories = [] } = useGetCategories();
  const categoryItems = useMemo<Item[]>(
    () => [
      { value: NO_CATEGORY, label: "بدون قسم" },
      ...categories.map((c) => ({ value: c.id, label: c.label })),
    ],
    [categories],
  );

  function changeUnit(next: string) {
    setField("unit", next);
    if (DECIMAL_UNITS.has(next)) setField("allowDecimal", true);
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
          <FieldSelect
            id={IDS.category}
            items={categoryItems}
            value={category || NO_CATEGORY}
            onChange={(next) =>
              setField("category", next === NO_CATEGORY ? "" : next)
            }
          />
        </FormField>

        <FormField
          id={IDS.unit}
          label="وحدة البيع الأساسية"
          error={errors.unit?.message}
        >
          <FieldSelect
            id={IDS.unit}
            items={UNIT_ITEMS}
            value={unit}
            onChange={changeUnit}
          />
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
    </FormSection>
  );
}
