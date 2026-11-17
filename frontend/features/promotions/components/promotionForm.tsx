"use client";

import {
  IconDeviceFloppy,
  IconLoader2,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";

import { OptionSelect } from "@/components/shared/OptionSelect";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { normalizeSearch } from "@/features/pos/lib/posCalc";
import useGetCategories from "@/features/products/hooks/useGetCategories";
import { fetchAllProducts } from "@/features/purchases/api/purchases.api";
import { normalizeDigits, parseNumberInput } from "@/lib/format";
import { cn } from "@/lib/utils";

import { useSavePromotion } from "../hooks/usePromotions";
import { promoHeadline } from "../lib/promotionText";
import type { Draft, Promotion, PromotionInput } from "../types/promotion";
import { AppTooltip } from "@/components/shared/AppTooltip";
import {
  BUY_GET_PRESETS,
  KINDS,
  PERCENT_PRESETS,
  SCOPES,
} from "../constants/promotionConstants";

const fromPromotion = (p: Promotion | null): Draft => ({
  name: p?.name ?? "",
  kind: p?.kind ?? "buy_get",
  value: p && p.kind !== "buy_get" ? String(p.value) : "",
  buyQty: String(p?.buyQty ?? 2),
  getQty: String(p?.getQty ?? 1),
  minQty: p?.minQty ? String(p.minQty) : "",
  scope: p?.scope ?? "products",
  categoryId: p?.categoryId ?? "",
  productIds: p?.productIds ?? [],
  startsOn: p?.startsOn ?? "",
  endsOn: p?.endsOn ?? "",
  isActive: p?.isActive ?? true,
});

const num = (text: string) => parseNumberInput(normalizeDigits(text));
const int = (text: string) => {
  const n = num(text);
  return Number.isInteger(n) && n > 0 ? n : null;
};

function validate(d: Draft): string | null {
  if (d.kind === "buy_get" && (!int(d.buyQty) || !int(d.getQty)))
    return "اكتب كمية الشراء وكمية الهدية أرقاماً صحيحة";
  if (d.kind === "percent" && !(num(d.value) >= 1 && num(d.value) <= 100))
    return "نسبة الخصم من 1 إلى 100";
  if (d.kind === "amount" && !(num(d.value) > 0)) return "اكتب مبلغ الخصم";
  if (d.scope === "products" && d.productIds.length === 0)
    return "اختر صنفاً واحداً على الأقل";
  if (d.scope === "category" && !d.categoryId) return "اختر القسم";
  if (d.startsOn && d.endsOn && d.startsOn > d.endsOn)
    return "تاريخ البداية بعد تاريخ النهاية";
  return null;
}

function toInput(d: Draft): PromotionInput {
  return {
    name:
      d.name.trim() ||
      promoHeadline({
        kind: d.kind,
        value: num(d.value),
        buyQty: int(d.buyQty),
        getQty: int(d.getQty),
      }),
    kind: d.kind,
    value: d.kind === "buy_get" ? 0 : num(d.value),
    buyQty: int(d.buyQty),
    getQty: int(d.getQty),
    minQty: d.minQty.trim() && num(d.minQty) > 0 ? num(d.minQty) : null,
    scope: d.scope,
    categoryId: d.categoryId || null,
    productIds: d.productIds,
    startsOn: d.startsOn || null,
    endsOn: d.endsOn || null,
    isActive: d.isActive,
  };
}

/** اختيار الأصناف: بحث بالاسم أو الباركود + الأصناف المختارة كشارات. */
function ProductPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const products = useQuery({
    queryKey: ["promotions", "products"],
    queryFn: fetchAllProducts,
    staleTime: 60_000,
  });
  const [query, setQuery] = useState("");
  const all = useMemo(
    () => (products.data ?? []).filter((p) => p.isActive),
    [products.data],
  );
  const byId = useMemo(() => new Map(all.map((p) => [p.id, p])), [all]);
  const q = normalizeSearch(query);
  const results = q
    ? all
        .filter(
          (p) => normalizeSearch(p.name).includes(q) || p.barcode.includes(q),
        )
        .slice(0, 8)
    : [];

  const toggle = (id: string) =>
    onChange(
      value.includes(id) ? value.filter((x) => x !== id) : [...value, id],
    );

  return (
    <div className="space-y-2">
      <div className="relative">
        <IconSearch className="pointer-events-none absolute inset-s-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            products.isPending
              ? "جارٍ تحميل الأصناف…"
              : "ابحث باسم الصنف أو الباركود"
          }
          className="h-10 ps-8"
          aria-label="بحث عن صنف"
        />
      </div>
      {results.length > 0 && (
        <ul className="max-h-44 divide-y overflow-y-auto border">
          {results.map((p) => (
            <li key={p.id}>
              <label className="flex cursor-pointer items-center gap-2 p-2 text-sm hover:bg-muted">
                <Checkbox
                  checked={value.includes(p.id)}
                  onCheckedChange={() => toggle(p.id)}
                />
                <AppTooltip message={p.name} onlyWhenTruncated>
                  <span className="flex-1 truncate">{p.name}</span>
                </AppTooltip>
                <span className="font-mono text-xs text-muted-foreground">
                  {p.salePrice}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 bg-primary/10 py-0.5 ps-2 pe-1 text-xs text-primary"
            >
              {byId.get(id)?.name ?? "…"}
              <button
                type="button"
                aria-label="إزالة"
                onClick={() => toggle(id)}
                className="p-0.5 hover:bg-primary/20"
              >
                <IconX className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">لم تختر أصنافاً بعد.</p>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function PromotionForm({
  promotion,
  onDone,
}: {
  promotion: Promotion | null;
  onDone: () => void;
}) {
  const save = useSavePromotion();
  const categories = useGetCategories().data ?? [];
  const [d, setD] = useState<Draft>(() => fromPromotion(promotion));
  const [submitted, setSubmitted] = useState(false);
  const patch = (p: Partial<Draft>) => setD((prev) => ({ ...prev, ...p }));
  const error = validate(d);
  const preview = promoHeadline({
    kind: d.kind,
    value: num(d.value) || 0,
    buyQty: int(d.buyQty),
    getQty: int(d.getQty),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (error) return;
    save.mutate({ promotion, input: toInput(d) }, { onSuccess: onDone });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* 1) نوع العرض */}
      <div className="grid grid-cols-3 gap-2">
        {KINDS.map((k) => (
 