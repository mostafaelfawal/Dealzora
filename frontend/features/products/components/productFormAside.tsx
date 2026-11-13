"use client";

import {
  IconBarcode,
  IconCalendarTime,
  IconCircleCheckFilled,
  IconCircleDashed,
  IconScale,
} from "@tabler/icons-react";
import { useWatch } from "react-hook-form";

import { SwitchField } from "@/components/shared/form";
import { Money } from "@/components/shared/Money";
import { cn } from "@/lib/utils";

import {
  NO_CATEGORY,
  PRODUCT_FIELD_IDS as IDS,
} from "../config/productFormFields";
import useGetCategories from "../hooks/useGetCategories";
import { useProductFormFields } from "../hooks/useProductFormFields";
import { calcMargin, numberOrZero, parseNumber } from "../lib/productCalc";
import { focusById } from "../lib/productFormFocus";

function Tag({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px]",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** نسخة مصغرة من بطاقة الصنف في الكاشير: التاجر يشوف النتيجة وهو بيكتب. */
function PosPreview() {
  const { form } = useProductFormFields();
  const [
    name,
    salePrice,
    unit,
    barcode,
    category,
    allowDecimal,
    scaleCode,
    wholesalePrice,
    trackExpiry,
    isActive,
    extraUnits,
  ] = useWatch({
    control: form.control,
    name: [
      "name",
      "salePrice",
      "unit",
      "barcode",
      "category",
      "allowDecimal",
      "scaleCode",
      "wholesalePrice",
      "trackExpiry",
      "isActive",
      "extraUnits",
    ],
  });
  const categories = useGetCategories().data ?? [];
  const categoryName =
    category && category !== NO_CATEGORY
      ? categories.find((c) => c.id === category)?.label
      : null;
  const price = numberOrZero(parseNumber(salePrice));

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        هكذا سيظهر في الكاشير
      </p>
      <div
        className={cn(
          "space-y-2 border bg-background p-3",
          !isActive && "opacity-60",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "text-sm font-semibold",
              !name.trim() && "text-muted-foreground",
            )}
          >
            {name.trim() || "اسم الصنف"}
          </p>
          {categoryName && (
            <Tag className="shrink-0 bg-muted text-muted-foreground">
              {categoryName}
            </Tag>
          )}
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <Money amount={price} className="text-xl font-bold" />
          <span className="text-xs text-muted-foreground">
            / {unit || "قطعة"}
          </span>
        </div>
        {barcode.trim() && (
          <p className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
            <IconBarcode className="size-3.5" />
            {barcode.trim()}
          </p>
        )}
        <div className="flex flex-wrap gap-1">
          {!isActive && (
            <Tag className="bg-destructive/10 text-destructive">معطّل</Tag>
          )}
          {allowDecimal && (
            <Tag className="bg-muted text-foreground">بالوزن</Tag>
          )}
          {allowDecimal && scaleCode.trim() && (
            <Tag className="bg-muted text-foreground">
              <IconScale className="size-3" /> ميزان {scaleCode.trim()}
            </Tag>
          )}
          {wholesalePrice.trim() && (
            <Tag className="bg-primary/10 text-primary">
              جملة {wholesalePrice}
            </Tag>
          )}
          {extraUnits.length > 0 && (
            <Tag className="bg-muted text-foreground">
              + {extraUnits.map((u) => u.name || "وحدة").join("، ")}
            </Tag>
          )}
          {trackExpiry && (
            <Tag className="bg-warning/15 text-warning">
              <IconCalendarTime className="size-3" /> بصلاحية
            </Tag>
          )}
        </div>
      </div>
    </div>
  );
}

/** الربح في القطاعي والجملة. */
function ProfitSummary() {
  const { form } = useProductFormFields();
  const [costPrice, salePrice, wholesalePrice] = useWatch({
    control: form.control,
    name: ["costPrice", "salePrice", "wholesalePrice"],
  });
  const cost = numberOrZero(parseNumber(costPrice));
  if (!(cost > 0)) return null;
  const rows = [
    {
      label: "قطاعي",
      m: calcMargin(cost, numberOrZero(parseNumber(salePrice))),
    },
    {
      label: "جملة",
      m: calcMargin(cost, numberOrZero(parseNumber(wholesalePrice))),
    },
  ].filter((r) => r.m);
  if (!rows.length) return null;
  return (
    <dl className="space-y-1.5 border-t pt-3 text-xs">
      {rows.map(({ label, m }) => (
        <div key={label} className="flex items-center justify-between">
          <dt className="text-muted-foreground">ربح {label}</dt>
          <dd
            className={cn(
              "flex items-baseline gap-1",
              m!.percent < 0
                ? "text-destructive"
                : m!.percent < 10
                  ? "text-warning"
                  : "text-success",
            )}
          >
            <Money amount={m!.profit} className="text-xs" />
            <bdi dir="ltr" className="font-mono">
              ({m!.percent}%)
            </bdi>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** اكتمال البيانات: المطلوب أولاً ثم المفيد، وكل عنصر ينقلك لحقله. */
function Completeness() {
  const { form } = useProductFormFields();
  const [name, salePrice, costPrice, barcode, category, minStock] = useWatch({
    control: form.control,
    name: ["name", "salePrice", "costPrice", "barcode", "category", "minStock"],
  });
  const items = [
    {
      done: Boolean(name.trim()),
      label: "اسم الصنف",
      id: IDS.name,
      required: true,
    },
    {
      done: numberOrZero(parseNumber(salePrice)) > 0,
      label: "سعر البيع",
      id: IDS.salePrice,
      required: true,
    },
    {
      done: numberOrZero(parseNumber(costPrice)) > 0,
      label: "سعر الشراء (لحساب الربح)",
      id: IDS.costPrice,
    },
    {
      done: Boolean(barcode.trim()),
      label: "الباركود (للبيع بالماسح)",
      id: IDS.barcode,
    },
    {
      done: Boolean(category) && category !== NO_CATEGORY,
      label: "القسم (للبحث والتقارير)",
      id: IDS.category,
    },
    {
      done: numberOrZero(parseNumber(minStock)) > 0,
      label: "الحد الأدنى (تنبيه النواقص)",
      id: IDS.minStock,
    },
  ];
  const done = items.filter((i) => i.done).length;
  const percent = Math.round((done / items.length) * 100);

  return (
    <div className="space-y-2 border-t pt-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">اكتمال البيانات</span>
        <bdi dir="ltr" className="font-mono text-muted-foreground">
          {percent}%
        </bdi>
      </div>
      <div className="h-1.5 bg-muted" aria-hidden>
        <div
          className={cn(
            "h-full transition-all",
            percent === 100 ? "bg-success" : "bg-primary",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <ul className="space-y-0.5">
        {items.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              onClick={() => focusById(i.id)}
              className="flex w-full items-center gap-2 px-1 py-1 text-start text-xs hover:bg-muted"
            >
              {i.done ? (
                <IconCircleCheckFilled className="size-4 shrink-0 text-success" />
              ) : (
                <IconCircleDashed
                  className={cn(
                    "size-4 shrink-0",
                    i.required ? "text-destructive" : "text-muted-foreground",
                  )}
                />
              )}
              <span
                className={cn(i.done && "text-muted-foreground line-through")}
              >
                {i.label}
                {i.required && !i.done && (
                  <span className="text-destructive"> *</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** اللوحة الجانبية: معاينة + ربح + اكتمال + الحالة. لاصقة على الشاشات الكبيرة. */
export function ProductFormAside() {
  const { form, setField } = useProductFormFields();
  const isActive = useWatch({ control: form.control, name: "isActive" });
  return (
    <aside className="space-y-3 border bg-card p-4 lg:sticky lg:top-4">
      <PosPreview />
      <ProfitSummary />
      <Completeness />
      <SwitchField
        id={IDS.isActive}
        label="يظهر في الكاشير"
        description="أوقفه إذا لم يكن الصنف متاحاً مؤقتاً بدلاً من حذفه."
        checked={isActive}
        onCheckedChange={(checked) => setField("isActive", checked)}
        className="border-t pt-3"
      />
    </aside>
  );
}
