"use client";

import { errorId, FormField, FormSection } from "@/components/shared/form";
import { Input } from "@/components/ui/input";

import { PRODUCT_FIELD_IDS as IDS } from "../config/productFormFields";
import { useProductFormFields } from "../hooks/useProductFormFields";

const QTY_INPUT = {
  dir: "ltr",
  inputMode: "decimal",
  autoComplete: "off",
  placeholder: "0",
  className: "font-mono",
} as const;

/** حد التنبيه دائماً، والرصيد الافتتاحي عند الإضافة فقط. */
export function ProductFormStock() {
  const { form, isEditing } = useProductFormFields();
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <FormSection title="المخزون">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id={IDS.minStock}
          label="الحد الأدنى للتنبيه"
          error={errors.minStock?.message}
        >
          <Input
            id={IDS.minStock}
            {...QTY_INPUT}
            {...register("minStock")}
            aria-invalid={Boolean(errors.minStock)}
            aria-describedby={errorId(IDS.minStock)}
          />
        </FormField>

        {!isEditing && (
          <FormField
            id={IDS.openingStock}
            label="الرصيد الافتتاحي"
            error={errors.openingStock?.message}
          >
            <Input
              id={IDS.openingStock}
              {...QTY_INPUT}
              {...register("openingStock")}
              aria-invalid={Boolean(errors.openingStock)}
              aria-describedby={errorId(IDS.openingStock)}
            />
          </FormField>
        )}
      </div>

      {isEditing && (
        <p className="text-xs text-muted-foreground">
          الرصيد الحالي يتغيّر من حركات الشراء والبيع والجرد، وليس من هنا.
        </p>
      )}
    </FormSection>
  );
}
