"use client";

import { IconBuildingStore, IconReceiptTax } from "@tabler/icons-react";
import { useWatch } from "react-hook-form";
import { toast } from "sonner";

import {
  CollapsibleSection,
  errorId,
  FormField,
  FormSection,
} from "@/components/shared/form";
import { Money } from "@/components/shared/Money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatRate,
  TAX_TYPE_LABEL,
  TAX_TYPES,
  useTaxConfig,
} from "@/lib/tax";
import { cn } from "@/lib/utils";

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
  className: "h-11 font-mono text-base",
} as const;

/** «ربحك في القطعة 5.00 (20%)» تحت الأسعار مباشرة، بلون يوضح الخسارة أو الهامش الضعيف. */
function ProfitLine({
  cost,
  sale,
  unit,
}: {
  cost: number;
  sale: number;
  unit: string;
}) {
  const margin = calcMargin(cost, sale);
  if (!margin || !(cost > 0)) {
    return (
      <p className="text-xs text-muted-foreground">
        اكتب سعر الشراء لنحسب لك ربحك في كل {unit}.
      </p>
    );
  }
  const tone =
    margin.percent < 0
      ? "border-destructive/40 bg-destructive/5 text-destructive"
      : margin.percent < 10
        ? "border-warning/40 bg-warning/5 text-warning"
        : "border-success/40 bg-success/5 text-success";
  return (
    <p
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-1.5 border px-3 py-2 text-sm",
        tone,
      )}
    >
      {margin.percent < 0 ? "خسارة في كل" : "ربحك في كل"} {unit}:
      <Money
        amount={Math.abs(margin.profit)}
        className="text-sm font-semibold"
      />
      <bdi dir="ltr" className="font-mono text-xs">
        ({margin.percent}%)
      </bdi>
      {margin.percent < 10 && margin.percent >= 0 && (
        <span className="text-xs">· هامش ضعيف</span>
      )}
    </p>
  );
}

/** سعر الجملة: قسم قابل للطي (مفتوح لو للصنف سعر جملة). */
function WholesaleSection({ unit, sale }: { unit: string; sale: number }) {
  const { form } = useProductFormFields();
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const [wholesalePrice, wholesaleMinQty] = useWatch({
    control,
    name: ["wholesalePrice", "wholesaleMinQty"],
  });
  const wholesale = numberOrZero(parseNumber(wholesalePrice));
  const summary = wholesale
    ? `${wholesale} لكل ${unit}${wholesaleMinQty.trim() ? ` من ${wholesaleMinQty} ${unit}` : " لعملاء الجملة"}`
    : "غير مستخدم · للتجار وعملاء الكميات";

  return (
    <CollapsibleSection
      title="سعر الجملة"
      summary={summary}
      icon={<IconBuildingStore />}
      defaultOpen={Boolean(wholesalePrice.trim())}
      forceOpen={Boolean(errors.wholesalePrice || errors.wholesaleMinQty)}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id={IDS.wholesalePrice}
          label={`سعر الجملة لل${unit}`}
          error={errors.wholesalePrice?.message}
          hint={
            wholesale > 0 && sale > 0
              ? `أقل من القطاعي بـ ${Math.round((1 - wholesale / sale) * 100)}%`
              : undefined
          }
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
          label={`يبدأ من كمية (${unit})`}
          error={errors.wholesaleMinQty?.message}
          hint="فارغ = لعملاء الجملة فقط"
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
      </div>
      <p className="text-xs text-muted-foreground">
        يطبّقه الكاشير تلقائياً: لعميل مسجّل بصفة «عميل جملة»، أو لأي عميل يشتري
        هذه الكمية أو أكثر.
      </p>
    </CollapsibleSection>
  );
}

/** ضريبة القيمة المضافة للصنف: تظهر فقط لو المحل فعّل الضريبة من الإعدادات. */
function TaxSection() {
  const { form, setField } = useProductFormFields();
  const tax = useTaxConfig();
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const [taxType, taxRate] = useWatch({
    control,
    name: ["taxType", "taxRate"],
  });
  if (!tax.enabled) return null;
  const taxable = taxType === "taxable";
  const summary = taxable
    ? `${TAX_TYPE_LABEL.taxable} ${formatRate(Number(taxRate) || tax.defaultRate)}`
    : TAX_TYPE_LABEL[taxType];

  return (
    <CollapsibleSection
      title="ضريبة القيمة المضافة"
      summary={summary}
      icon={<IconReceiptTax />}
      defaultOpen={false}
      forceOpen={Boolean(errors.taxRate)}
    >
      <div
        className="flex flex-wrap gap-1.5"
        role="radiogroup"
        aria-label="المعاملة الضريبية"
      >
        {TAX_TYPES.map((t) => (
          <Button
            key={t}
            type="button"
            size="sm"
            role="radio"
            aria-checked={taxType === t}
            variant={taxType === t ? "default" : "outline"}
            onClick={() => setField("taxType", t)}
            className="font-normal"
          >
            {TAX_TYPE_LABEL[t]}
          </Button>
        ))}
      </div>
      {taxable && (
        <div className="max-w-48">
          <FormField
            id={IDS.taxRate}
            label="نسبة الضريبة %"
            error={errors.taxRate?.message}
            hint={`فارغ = ${formatRate(tax.defaultRate)} (افتراضي المحل)`}
          >
            <Input
              id={IDS.taxRate}
              {...PRICE_INPUT}
              {...register("taxRate")}
              placeholder={String(tax.defaultRate)}
              aria-invalid={Boolean(errors.taxRate)}
              aria-describedby={errorId(IDS.taxRate)}
            />
          </FormField>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {tax.pricesIncludeTax
          ? "سعر البيع شامل الضريبة (حسب إعداد المحل)."
          : "تُضاف الضريبة على سعر البيع في الفاتورة (حسب إعداد المحل)."}{" "}
        الوحدات الإضافية (كرتونة/دستة) تأخذ نفس المعاملة.
      </p>
    </CollapsibleSection>
  );
}

export function ProductFormPricing() {
  const { form, setField } = useProductFormFields();
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const [costPrice, salePrice, unit] = useWatch({
    control,
    name: ["costPrice", "salePrice", "unit"],
  });

  const cost = numberOrZero(parseNumber(costPrice));
  const sale = numberOrZero(parseNumber(salePrice));
  const hasMargin = Boolean(calcMargin(cost, sale)) && cost > 0;
  const unitName = unit || "قطعة";

  function applyMarkup(percent: number) {
    if (!(cost > 0)) {
      toast.info("اكتب سعر الشراء أولاً");
      focusById(IDS.costPrice);
      return;
    }
    setField("salePrice", String(suggestSalePrice(cost, percent)));
  }

  return (
    <>
      <FormSection
        title="الأسعار"
        description={`لكل ${unitName}`}
        action={hasMargin && <ProductMarginBadge cost={cost} sale={sale} />}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id={IDS.costPrice}
            label="سعر الشراء (التكلفة)"
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

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">سعر بيع بربح:</span>
          {MARKUP_PRESETS.map((percent) => (
            <Button
              key={percent}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => applyMarkup(percent)}
              className="font-normal"
            >
              <bdi dir="ltr" className="font-mono">
                +{percent}%
              </bdi>
            </Button>
          ))}
        </div>

        <ProfitLine cost={cost} sale={sale} unit={unitName} />
      </FormSection>

      <WholesaleSection unit={unitName} sale={sale} />
      <TaxSection />
    </>
  );
}
