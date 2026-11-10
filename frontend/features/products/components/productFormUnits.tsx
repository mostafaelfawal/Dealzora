"use client";

import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useWatch, type FieldErrors } from "react-hook-form";

import { errorId, FieldError, FormSection } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  PRODUCT_FIELD_IDS as IDS,
  UNIT_KEYS,
  unitFieldId,
  type UnitKey,
} from "../config/productFormFields";
import { EXTRA_UNIT_PRESETS, MAX_EXTRA_UNITS } from "../config/productOptions";
import { useProductFormFields } from "../hooks/useProductFormFields";
import { newLocalId } from "../lib/productCalc";
import type { UnitSchemaType } from "../schema/product.schema";

type RowErrors = FieldErrors<UnitSchemaType> | undefined;

const COLUMN_PROPS: Record<
  UnitKey,
  { placeholder: string; ltr?: boolean; decimal?: boolean; mono?: boolean }
> = {
  name: { placeholder: "الاسم" },
  factor: { placeholder: "العدد", ltr: true, decimal: true, mono: true },
  barcode: { placeholder: "الباركود", ltr: true, mono: true },
  salePrice: { placeholder: "السعر", ltr: true, decimal: true, mono: true },
};

const firstRowMessage = (errors: RowErrors) =>
  UNIT_KEYS.map((k) => errors?.[k]?.message).find(Boolean);

function UnitRow({
  unit,
  index,
  baseUnit,
  errors,
  onChange,
  onRemove,
}: {
  unit: UnitSchemaType;
  index: number;
  baseUnit: string;
  errors: RowErrors;
  onChange: (key: UnitKey, value: string) => void;
  onRemove: () => void;
}) {
  const ariaLabel: Record<UnitKey, string> = {
    name: "اسم الوحدة",
    factor: `عدد ${baseUnit} في الوحدة`,
    barcode: "باركود الوحدة",
    salePrice: "سعر بيع الوحدة",
  };
  const message = firstRowMessage(errors);

  return (
    <li className="grid grid-cols-2 gap-2 border p-2.5 sm:grid-cols-[1fr_5rem_1fr_6rem_auto]">
      {UNIT_KEYS.map((key) => {
        const col = COLUMN_PROPS[key];
        return (
          <Input
            key={key}
            id={unitFieldId(key, index)}
            aria-label={ariaLabel[key]}
            aria-invalid={Boolean(errors?.[key])}
            dir={col.ltr ? "ltr" : undefined}
            inputMode={col.decimal ? "decimal" : undefined}
            value={unit[key]}
            onChange={(event) => onChange(key, event.target.value)}
            placeholder={col.placeholder}
            className={col.mono ? "font-mono" : undefined}
          />
        );
      })}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`حذف الوحدة ${unit.name || ""}`}
        onClick={onRemove}
        className="text-destructive"
      >
        <IconTrash />
      </Button>
      {message && (
        <p role="alert" className="col-span-full text-xs text-destructive">
          {message}
        </p>
      )}
    </li>
  );
}

function AddUnitButtons({ onAdd }: { onAdd: (name?: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {EXTRA_UNIT_PRESETS.map((preset) => (
        <Button
          key={preset}
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onAdd(preset)}
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
        onClick={() => onAdd()}
        className="gap-1 font-normal"
      >
        <IconPlus className="size-3.5" />
        وحدة أخرى
      </Button>
    </div>
  );
}

/** الكرتونة والدستة وغيرها. المخزون يُحسب دائماً بالوحدة الأساسية. */
export function ProductFormUnits() {
  const { form, setField } = useProductFormFields();
  const {
    control,
    formState: { errors },
  } = form;
  const [units, baseUnit] = useWatch({
    control,
    name: ["extraUnits", "unit"],
  });
  const canAdd = units.length < MAX_EXTRA_UNITS;

  function addUnit(name = "") {
    if (!canAdd) return;
    const row: UnitSchemaType = {
      id: newLocalId(),
      name,
      factor: "",
      barcode: "",
      salePrice: "",
    };
    setField("extraUnits", [...units, row]);
  }

  return (
    <FormSection
      title="وحدات بيع إضافية"
      description="مثل الكرتونة أو الدستة. المخزون يُحسب دائماً بالوحدة الأساسية."
      className="space-y-3"
    >
      {units.length > 0 && (
        <ul className="space-y-2">
          {units.map((unit, index) => (
            <UnitRow
              key={unit.id}
              unit={unit}
              index={index}
              baseUnit={baseUnit}
              errors={errors.extraUnits?.[index]}
              onChange={(key, value) =>
                setField(`extraUnits.${index}.${key}`, value)
              }
              onRemove={() =>
                setField(
                  "extraUnits",
                  units.filter((u) => u.id !== unit.id),
                )
              }
            />
          ))}
        </ul>
      )}

      <FieldError
        id={errorId(IDS.extraUnits)}
        message={errors.extraUnits?.root?.message ?? errors.extraUnits?.message}
      />

      {canAdd && <AddUnitButtons onAdd={addUnit} />}
    </FormSection>
  );
}
