"use client";

import {
  IconDeviceFloppy,
  IconGift,
  IconLoader2,
  IconPercentage,
  IconSearch,
  IconTag,
  IconX,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";

import { OptionSelect } from "@/components/shared/OptionSelect";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type {
  Promotion,
  PromotionInput,
  PromoKind,
  PromoScope,
} from "../types/promotion";

const KINDS: { id: PromoKind; label: string; icon: ReactNode; hint: string }[] =
  [
    {
      id: "buy_get",
      label: "اشتري واحصل",
      icon: <IconGift />,
      hint: "مثل: اشتري 2 وخد 1 مجاناً",
    },
    {
      id: "percent",
      label: "خصم بنسبة",
      icon: <IconPercentage />,
      hint: "مثل: خصم 10% على الصنف",
    },
    {
      id: "amount",
      label: "خصم مبلغ",
      icon: <IconTag />,
      hint: "مثل: 5 جنيه أقل على كل قطعة",
    },
  ];

const SCOPES: { id: PromoScope; label: string }[] = [
  { id: "products", label: "أصناف أختارها" },
  { id: "category", label: "قسم كامل" },
  { id: "all", label: "كل المحل" },
];

const BUY_GET_PRESETS = [
  [1, 1],
  [2, 1],
  [3, 1],
  [5, 1],
] as const;
const PERCENT_PRESETS = [5, 10, 15, 20, 25, 50];

interface Draft {
  name: string;
  kind: PromoKind;
  value: string;
  buyQty: string;
  getQty: string;
  minQty: string;
  scope: PromoScope;
  categoryId: string;
  productIds: string[];
  startsOn: string;
  endsOn: string;
  isActive: boolean;
}

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
    return "اكتب «اشتري كام» و«خد كام» أرقاماً صحيحة";
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
                <span className="flex-1 truncate">{p.name}</span>
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

function PromotionForm({
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
          <button
            key={k.id}
            type="button"
            aria-pressed={d.kind === k.id}
            onClick={() => patch({ kind: k.id })}
            className={cn(
              "flex flex-col items-center gap-1 border p-3 text-center transition-colors [&_svg]:size-6",
              d.kind === k.id
                ? "border-primary bg-primary/5 text-primary"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {k.icon}
            <span className="text-sm font-medium text-foreground">
              {k.label}
            </span>
            <span className="hidden text-[11px] sm:block">{k.hint}</span>
          </button>
        ))}
      </div>

      {/* 2) قيمة العرض */}
      {d.kind === "buy_get" ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            اشتري
            <Input
              value={d.buyQty}
              onChange={(e) => patch({ buyQty: e.target.value })}
              inputMode="numeric"
              dir="ltr"
              className="h-10 w-16 text-center font-mono"
              aria-label="اشتري كام"
            />
            وخد
            <Input
              value={d.getQty}
              onChange={(e) => patch({ getQty: e.target.value })}
              inputMode="numeric"
              dir="ltr"
              className="h-10 w-16 text-center font-mono"
              aria-label="خد كام مجاناً"
            />
            مجاناً من نفس الصنف
          </div>
          <div className="flex flex-wrap gap-1.5">
            {BUY_GET_PRESETS.map(([b, g]) => (
              <Button
                key={`${b}-${g}`}
                type="button"
                size="sm"
                variant={
                  int(d.buyQty) === b && int(d.getQty) === g
                    ? "default"
                    : "outline"
                }
                onClick={() => patch({ buyQty: String(b), getQty: String(g) })}
                className="font-normal"
              >
                {b} + {g}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label={d.kind === "percent" ? "نسبة الخصم %" : "الخصم على كل قطعة"}
          >
            <Input
              value={d.value}
              onChange={(e) => patch({ value: e.target.value })}
              inputMode="decimal"
              dir="ltr"
              className="h-10 font-mono"
              placeholder={d.kind === "percent" ? "10" : "5"}
            />
            {d.kind === "percent" && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {PERCENT_PRESETS.map((p) => (
                  <Button
                    key={p}
                    type="button"
                    size="sm"
                    variant={num(d.value) === p ? "default" : "outline"}
                    onClick={() => patch({ value: String(p) })}
                    className="font-normal"
                  >
                    {p}%
                  </Button>
                ))}
              </div>
            )}
          </Field>
          <Field
            label="لما يشتري على الأقل (اختياري)"
            hint="مثال: 3 = الخصم يبدأ من 3 قطع. فارغ = من أول قطعة."
          >
            <Input
              value={d.minQty}
              onChange={(e) => patch({ minQty: e.target.value })}
              inputMode="decimal"
              dir="ltr"
              className="h-10 font-mono"
              placeholder="1"
            />
          </Field>
        </div>
      )}

      {/* 3) على أي أصناف */}
      <div className="space-y-2">
        <Label>العرض على</Label>
        <SegmentedTabs
          label="العرض على"
          items={SCOPES}
          value={d.scope}
          onChange={(scope) => patch({ scope })}
        />
        {d.scope === "products" && (
          <ProductPicker
            value={d.productIds}
            onChange={(productIds) => patch({ productIds })}
          />
        )}
        {d.scope === "category" && (
          <OptionSelect
            label="القسم"
            items={[
              { value: "", label: "اختر القسم" },
              ...categories.map((c) => ({ value: c.id, label: c.label })),
            ]}
            value={d.categoryId}
            onChange={(categoryId) => patch({ categoryId })}
            className="w-full"
          />
        )}
        {d.scope === "all" && (
          <p className="text-xs text-muted-foreground">
            على كل أصناف المحل (ما عدا ما يُباع بسعر الجملة).
          </p>
        )}
      </div>

      {/* 4) المدة والاسم */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="من يوم (اختياري)">
          <Input
            type="date"
            value={d.startsOn}
            onChange={(e) => patch({ startsOn: e.target.value })}
            dir="ltr"
            className="h-10 font-mono"
          />
        </Field>
        <Field label="إلى يوم (اختياري)">
          <Input
            type="date"
            value={d.endsOn}
            onChange={(e) => patch({ endsOn: e.target.value })}
            dir="ltr"
            className="h-10 font-mono"
          />
        </Field>
        <Field label="اسم العرض (اختياري)">
          <Input
            value={d.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder={preview}
            maxLength={80}
            className="h-10"
          />
        </Field>
      </div>

      <label className="flex items-center justify-between gap-3 border-t pt-3 text-sm">
        <span>
          العرض شغال
          <span className="block text-xs text-muted-foreground">
            يظهر في الكاشير ويُطبق تلقائياً على الفاتورة.
          </span>
        </span>
        <Switch
          checked={d.isActive}
          onCheckedChange={(isActive) => patch({ isActive })}
        />
      </label>

      {submitted && error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="lg" onClick={onDone}>
          إلغاء
        </Button>
        <Button
          type="submit"
          size="lg"
          disabled={save.isPending}
          className="gap-2"
        >
          {save.isPending ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconDeviceFloppy className="size-4" />
          )}
          حفظ العرض
        </Button>
      </div>
    </form>
  );
}

/** promotion: null = عرض جديد. open يتحكم في الظهور. */
export function PromotionFormDialog({
  open,
  promotion,
  onClose,
}: {
  open: boolean;
  promotion: Promotion | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="text-start">
          <DialogTitle>{promotion ? "تعديل العرض" : "عرض جديد"}</DialogTitle>
          <DialogDescription>
            العرض يُطبَّق تلقائياً في الكاشير على الأصناف المختارة، بدون ما الكاشير
            يعمل أي حاجة.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <PromotionForm
            key={promotion?.id ?? "new"}
            promotion={promotion}
            onDone={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
