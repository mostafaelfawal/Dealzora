"use client";

import { useWatch } from "react-hook-form";
import { toast } from "sonner";

import { errorId, FormField, FormSection } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { PRODUCT_FIELD_IDS as IDS } from "../config/productFormFields";
import { MARKUP_PRESETS } from "../config/productOptions";
import { useProductFormFields } from "../hooks/useProductFormFields";
import {
  calcMargin,
  numberOrZero,
  parseNumber,
  suggestSalePrice,
} from "../lib/productCalc";
import { focusById } from "../lib/productFormFocus";
import { ProductMarginBadge } from "./productMarginBadge";

const PRICE_INPUT = {
  dir: "ltr",
  inputMode: "decimal",
  autoComplete: "off",
  placeholder: "0",
  className: "font-mono",
} as const;

export function ProductFormPricing() {
  const { form, setField } = useProductFormFields();
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const [costPrice, salePrice, wholesalePrice, unit] = useWatch({
    control,
    name: ["costPrice", "salePrice", "wholesalePrice", "unit"],
  });

  const cost = numberOrZero(parseNumber(costPrice));
  const sale = numberOrZero(parseNumber(salePrice));
  const hasMargin = Boolean(calcMargin(cost, sale));

  function applyMarkup(percent: number) {
    if (!(cost > 0)) {
      toast.info("اكتب سعر الشراء أولاً");
      focusById(IDS.costPrice);
      return;
    }
    setField("salePrice", String(suggestSalePrice(cost, percent)));
  }

  return (
    <FormSection
      title="الأسعار"
      action={hasMargin && <ProductMarginBadge cost={cost} sale={sale} />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id={IDS.costPrice}
          label="سعر الشراء"
          error={errors.costPrice?.message}
        >
          <Input
            id={IDS.costPrice}
            {...PRICE_INPUT}
            {...register("costPrice")}
            aria-invalid={Boolean(errors.costPrice)}
            aria-describedby={errorId(IDS.costPrice)}
          />
        </FormField>

        <FormField
          id={IDS.salePrice}
          label="سعر البيع *"
          error={errors.salePrice?.message}
        >
          <Input
            id={IDS.salePrice}
            {...PRICE_INPUT}
            {...register("salePrice")}
            aria-invalid={Boolean(errors.salePrice)}
            aria-describedby={errorId(IDS.salePrice)}
          />
        </FormField>
      </div>

      <div className="grid gap-4 border-t pt-3 sm:grid-cols-2">
        <FormField
          id={IDS.wholesalePrice}
          label="سعر الجملة"
          error={errors.wholesalePrice?.message}
        >
          <Input
            id={IDS.wholesalePrice}
            {...PRICE_INPUT}
            {...register("wholesalePrice")}
            placeholder="اختياري"
            aria-invalid={Boolean(errors.wholesalePrice)}
            aria-describedby={errorId(IDS.wholesalePrice)}
          />
        </FormField>
        <FormField
          id={IDS.wholesaleMinQty}
          label={`سعر الجملة من كمية (${unit || "قطعة"})`}
          error={errors.wholesaleMinQty?.message}
        >
          <Input
            id={IDS.wholesaleMinQty}
            {...PRICE_INPUT}
            {...register("wholesaleMinQty")}
            disabled={!wholesalePrice.trim()}
            placeholder="مثال: 12"
            aria-invalid={Boolean(errors.wholesaleMinQty)}
            aria-describedby={errorId(IDS.wholesaleMinQty)}
          />
        </FormField>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          سعر الجملة يُطبَّق تلقائياً في الكاشير لعميل الجملة، أو لأي عميل لما يشتري
          الكمية دي أو أكتر. اترك الكمية فارغة لو الجملة لعملاء الجملة فقط.
        </p>
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
    </FormSection>
  );
}
