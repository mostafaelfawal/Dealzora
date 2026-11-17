"use client";

import { IconWorldSearch } from "@tabler/icons-react";
import { useWatch } from "react-hook-form";
import { toast } from "sonner";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { Button } from "@/components/ui/button";
import { ARAB_CURRENCIES } from "@/features/settings/config/currencies";
import { useCurrency } from "@/lib/currency";
import { openExternal } from "@/lib/external";
import { usePaymentConfig } from "@/lib/payments";

import { NO_CATEGORY } from "../config/productFormFields";
import useGetCategories from "../hooks/useGetCategories";
import { useProductFormFields } from "../hooks/useProductFormFields";

/** أقل طول لاسم الصنف حتى يكون البحث مفيداً. */
const MIN_NAME = 2;
/** الوحدة الافتراضية لا تضيف شيئاً للبحث. */
const PLAIN_UNIT = "قطعة";

/**
 * دولة المحل من الإعدادات: دولة طرق الدفع إن اختيرت، وإلا دولة العملة.
 * عملة «أخرى» بلا دولة معروفة = بحث بلا دولة.
 */
function useShopCountry(): { iso: string; name: string } | null {
  const payments = usePaymentConfig();
  const currency = useCurrency();
  const match =
    ARAB_CURRENCIES.find((c) => c.iso === payments.country) ??
    ARAB_CURRENCIES.find((c) => c.code === currency.code);
  return match ? { iso: match.iso, name: match.country } : null;
}

/** «معرفة سعر المنتج»: بحث جوجل باسم الصنف وقسمه ووحدته ودولة المحل. */
export function ProductPriceLookup() {
  const { form } = useProductFormFields();
  const [name, category, unit, allowDecimal] = useWatch({
    control: form.control,
    name: ["name", "category", "unit", "allowDecimal"],
  });
  const { data: categories = [] } = useGetCategories();
  const country = useShopCountry();

  const productName = (name ?? "").trim();
  const ready = productName.length >= MIN_NAME && Boolean(unit);

  function search() {
    const categoryLabel =
      category && category !== NO_CATEGORY
        ? categories.find((c) => c.id === category)?.label
        : undefined;
    // الوحدة تُضاف فقط لو لها معنى ولم تُكتب في الاسم (مثلاً «1 كجم» موجودة فيه).
    const unitPart =
      unit && unit !== PLAIN_UNIT && !productName.includes(unit)
        ? allowDecimal
          ? `بال${unit}`
          : unit
        : null;
    const query = [
      "سعر",
      productName,
      unitPart,
      categoryLabel,
      country ? `في ${country.name}` : null,
    ]
      .filter(Boolean)
      .join(" ");

    const params = new URLSearchParams({ q: query, hl: "ar" });
    if (country) params.set("gl", country.iso);
    openExternal(`https://www.google.com/search?${params}`).catch(() =>
      toast.error("تعذّر فتح المتصفح"),
    );
  }

  return (
    <AppTooltip message="أكمل الحقول لمعرفة سعر المنتج" disabled={ready}>
      {/* الزر المعطّل لا يستقبل الماوس: الـ span يُظهر التلميح */}
      <span className="inline-flex">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!ready}
          onClick={search}
          className="gap-1.5"
        >
          <IconWorldSearch className="size-4" />
          معرفة سعر المنتج
        </Button>
      </span>
    </AppTooltip>
  );
}
