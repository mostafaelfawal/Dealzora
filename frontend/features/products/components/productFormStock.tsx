"use client";

import { useWatch } from "react-hook-form";

import {
  errorId,
  FormField,
  FormSection,
  SwitchField,
} from "@/components/shared/form";
import { PlanLock } from "@/components/shared/PlanGate";
import { Input } from "@/components/ui/input";
import { useFeature } from "@/lib/plan";

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
  const { form, isEditing, setField } = useProductFormFields();
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const [trackExpiry, openingStock] = useWatch({
    control,
    name: ["trackExpiry", "openingStock"],
  });
  const canTrack = useFeature("expiry");

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

      <SwitchField
        id="pf-track-expiry"
        label={
          <span className="inline-flex items-center gap-1.5">
            تتبع الصلاحية والدفعات
            {!canTrack && <PlanLock feature="expiry" />}
          </span>
        }
        description="كل كمية تدخل بتاريخ صلاحيتها، والبيع من الأقرب انتهاءً، والمنتهي ما يتباعش. للألبان والأدوية والمعلبات."
        checked={trackExpiry}
        disabled={!canTrack && !trackExpiry}
        onCheckedChange={(checked) => setField("trackExpiry", checked)}
        className="border-t pt-3"
      />

      {trackExpiry && !isEditing && openingStock.trim() !== "" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="pf-opening-expiry" label="صلاحية الرصيد الافتتاحي">
            <Input
              id="pf-opening-expiry"
              type="date"
              dir="ltr"
              className="font-mono"
              {...register("openingExpiry")}
            />
          </FormField>
          <FormField
            id="pf-opening-batch"
            label="رقم التشغيلة (اختياري)"
            error={errors.openingBatchNo?.message}
          >
            <Input
              id="pf-opening-batch"
              dir="ltr"
              autoComplete="off"
              className="font-mono"
              {...register("openingBatchNo")}
            />
          </FormField>
        </div>
      )}
    </FormSection>
  );
}
