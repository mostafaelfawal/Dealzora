"use client";

import {
  IconArrowRight,
  IconBarcode,
  IconDeviceFloppy,
  IconLoader2,
  IconPlus,
  IconTrash,
  IconTruckDelivery,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";

import { Money } from "@/components/shared/Money";
import { listItem, MotionTr } from "@/components/shared/motion";
import { OptionSelect } from "@/components/shared/OptionSelect";
import { PageHeader } from "@/components/shared/PageHeader";
import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { normalizeSearch, round2 } from "@/features/pos/lib/posCalc";
import type { Product } from "@/features/products/types/product";
import { SUPPLIER_ROUTES } from "@/features/suppliers/config/supplierRoutes";
import { useHotkey } from "@/hooks/useHotkey";
import { todayIso } from "@/lib/dates";
import { formatQty, moneyInputOrZero, parseNumberInput } from "@/lib/format";
import { plain } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";

import {
  useCreatePurchase,
  usePurchaseProducts,
  usePurchaseSuppliers,
} from "../hooks/usePurchases";
import type { PurchaseDraftLine } from "../types/purchase";

const SAVE_KEY = { label: "F9", match: plain("F9") };
const MAX_RESULTS = 8;

const lineValue = (l: PurchaseDraftLine) =>
  round2(moneyInputOrZero(l.qty) * moneyInputOrZero(l.cost));

function searchProducts(products: Product[], term: string) {
  const q = normalizeSearch(term);
  if (!q) return [];
  const tokens = q.split(/\s+/);
  return products
    .filter(
      (p) =>
        p.barcode === q ||
        (/^\d+$/.test(q) && p.barcode.includes(q)) ||
        tokens.every((t) => normalizeSearch(p.name).includes(t)),
    )
    .slice(0, MAX_RESULTS);
}

/** فاتورة شراء جديدة: المورد ← الأصناف (باركود أو اسم) ← المدفوع ← F9 للحفظ. */
export function PurchaseFormScreen() {
  const router = useRouter();
  const products = usePurchaseProducts();
  const suppliers = usePurchaseSuppliers();
  const save = useCreatePurchase();
  const searchRef = useRef<HTMLInputElement>(null);

  const [supplierId, setSupplierId] = useState("");
  const [supplierInvoice, setSupplierInvoice] = useState("");
  const [date, setDate] = useState(todayIso);
  const [lines, setLines] = useState<PurchaseDraftLine[]>([]);
  const [term, setTerm] = useState("");
  const [active, setActive] = useState(0);
  const [discount, setDiscount] = useState("");
  const [paid, setPaid] = useState("");
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const results = useMemo(
    () => searchProducts(products.data ?? [], term),
    [products.data, term],
  );
  const supplierItems = useMemo(
    () => [
      {
        value: "",
        label: suppliers.isPending ? "جارٍ التحميل…" : "اختر المورد",
      },
      ...(suppliers.data ?? [])
        .filter((s) => s.isActive)
        .map((s) => ({ value: s.id, label: s.name })),
    ],
    [suppliers.data, suppliers.isPending],
  );
  const supplier = suppliers.data?.find((s) => s.id === supplierId);

  const subtotal = round2(lines.reduce((sum, l) => sum + lineValue(l), 0));
  const discountValue = Math.min(moneyInputOrZero(discount), subtotal);
  const total = round2(subtotal - discountValue);
  const paidValue = moneyInputOrZero(paid);
  const remaining = round2(total - paidValue);

  const lineErrors = lines.map((l) => {
    const qty = parseNumberInput(l.qty);
    const cost = parseNumberInput(l.cost);
    if (!(qty > 0)) return "الكمية";
    if (!l.allowDecimal && !Number.isInteger(qty))
      return "الكمية لا تقبل كسوراً";
    if (!(cost >= 0)) return "سعر الشراء";
    if (l.salePrice.trim() && !(parseNumberInput(l.salePrice) > 0))
      return "سعر البيع";
    return null;
  });
  const errors = [
    !supplierId && "اختر المورد",
    lines.length === 0 && "أضف صنفاً واحداً على الأقل",
    lineErrors.some(Boolean) && "راجع الكميات والأسعار في الأصناف المظللة",
    paidValue > total && "المدفوع أكبر من إجمالي الفاتورة",
  ].filter(Boolean) as string[];

  function addProduct(p: Product) {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === p.id);
      if (existing)
        return prev.map((l) =>
          l.productId === p.id
            ? { ...l, qty: String(round2(moneyInputOrZero(l.qty) + 1)) }
            : l,
        );
      return [
        ...prev,
        {
          key: `${p.id}-${Date.now()}`,
          productId: p.id,
          name: p.name,
          unit: p.unit,
          allowDecimal: p.allowDecimal,
          currentCost: p.costPrice ?? 0,
          currentPrice: p.salePrice,
          qty: "1",
          cost: String(p.costPrice ?? 0),
          salePrice: "",
        },
      ];
    });
    setTerm("");
    setActive(0);
    searchRef.current?.focus();
  }

  function patchLine(key: string, patch: Partial<PurchaseDraftLine>) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );
  }

  function onSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length)
        setActive(
          (i) =>
            (i + (e.key === "ArrowDown" ? 1 : -1) + results.length) %
            results.length,
        );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const exact = (products.data ?? []).find(
        (p) => p.barcode === term.trim(),
      );
      const pick = exact ?? results[Math.min(active, results.length - 1)];
      if (pick) addProduct(pick);
    } else if (e.key === "Escape" && term) {
      e.preventDefault();
      setTerm("");
    }
  }

  function submit(andNew = false) {
    setSubmitted(true);
    if (errors.length || save.isPending) return;
    save.mutate(
      {
        supplierId,
        supplierInvoice,
        purchasedOn: date,
        discount: discountValue,
        paidAmount: paidValue,
        note,
        lines: lines.map((l) => ({
          productId: l.productId,
          qty: moneyInputOrZero(l.qty),
          unitCost: moneyInputOrZero(l.cost),
          newSalePrice: l.salePrice.trim()
            ? moneyInputOrZero(l.salePrice)
            : null,
        })),
      },
      {
        onSuccess: () => {
          if (!andNew) return router.push("/admin/purchases");
          setLines([]);
          setDiscount("");
          setPaid("");
          setNote("");
          setSupplierInvoice("");
          setSubmitted(false);
          searchRef.current?.focus();
        },
      },
    );
  }

  useHotkey(SAVE_KEY.match, () => submit(false));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <PageHeader
        title="فاتورة شراء جديدة"
        description="الأصناف تدخل المخزون ويتحدث متوسط سعر الشراء تلقائياً. الجزء غير المدفوع يُضاف لحساب المورد."
        actions={
          <Button
            variant="outline"
            size="lg"
            nativeButton={false}
            render={<Link href="/admin/purchases" />}
            className="h-10 gap-2 font-normal"
          >
            <IconArrowRight className="size-4" />
            المشتريات
          </Button>
        }
      />

      <section className="grid gap-3 border bg-card p-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>المورد *</Label>
          <OptionSelect
            label="المورد"
            items={supplierItems}
            value={supplierId}
            onChange={setSupplierId}
            className="w-full"
          />
          {supplier && (
            <p className="text-[11px] text-muted-foreground">
              رصيده الحالي:{" "}
              <Money amount={supplier.balance} className="text-[11px]" />
            </p>
          )}
          {suppliers.data?.length === 0 && (
            <Link
              href={SUPPLIER_ROUTES.new}
              className="text-[11px] text-primary underline"
            >
              أضف أول مورد
            </Link>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-ref">رقم فاتورة المورد</Label>
          <Input
            id="pf-ref"
            value={supplierInvoice}
            maxLength={40}
            onChange={(e) => setSupplierInvoice(e.target.value)}
            placeholder="اختياري"
            dir="ltr"
            className="h-10 font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-date">تاريخ الفاتورة</Label>
          <Input
            id="pf-date"
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            dir="ltr"
            className="h-10 font-mono"
          />
        </div>
      </section>

      <section className="relative">
        <InputGroup className="h-12">
          <InputGroupAddon>
            <IconBarcode />
          </InputGroupAddon>
          <InputGroupInput
            ref={searchRef}
            autoFocus
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setActive(0);
            }}
            onKeyDown={onSearchKey}
            placeholder={
              products.isPending
                ? "جارٍ تحميل الأصناف…"
                : "امسح الباركود أو اكتب اسم الصنف ثم Enter"
            }
            aria-label="إضافة صنف"
            className="text-base"
          />
        </InputGroup>
        {term.trim() && (
          <ul
            role="listbox"
            className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto border bg-popover shadow-lg"
          >
            {results.length === 0 ? (
              <li className="p-3 text-xs text-muted-foreground">
                لا يوجد صنف مطابق. أضفه أولاً من صفحة المنتجات.
              </li>
            ) : (
              results.map((p, i) => (
                <li
                  key={p.id}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addProduct(p);
                  }}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 px-3 py-2 text-sm",
                    i === active && "bg-muted",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    رصيد {formatQty(p.stock)} {p.unit}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    شراء{" "}
                    <Money amount={p.costPrice ?? 0} className="text-[11px]" />
                  </span>
                </li>
              ))
            )}
          </ul>
        )}
      </section>

      <div className="overflow-x-auto border">
        <table className="w-full min-w-[720px] text-xs">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr className="h-9 text-start">
              <th className="px-3 text-start font-normal">الصنف</th>
              <th className="w-28 px-2 text-start font-normal">الكمية</th>
              <th className="w-32 px-2 text-start font-normal">سعر الشراء</th>
              <th className="w-32 px-2 text-start font-normal">سعر بيع جديد</th>
              <th className="w-32 px-2 text-start font-normal">الإجمالي</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-14 text-center text-muted-foreground"
                >
                  <IconTruckDelivery className="mx-auto mb-2 size-8" />
                  ابدأ بمسح باركود أول صنف في فاتورة المورد
                </td>
              </tr>
            ) : (
              lines.map((l, i) => (
                <MotionTr
                  key={l.key}
                  {...listItem(i)}
                  className={cn(
                    "h-14 border-t",
                    submitted && lineErrors[i] && "bg-destructive/5",
                  )}
                >
                  <td className="px-3">
                    <p className="truncate font-medium">{l.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      الشراء الحالي{" "}
                      <Money amount={l.currentCost} className="text-[11px]" /> ·
                      البيع{" "}
                      <Money amount={l.currentPrice} className="text-[11px]" />{" "}
                      / {l.unit}
                    </p>
                  </td>
                  <td className="px-2">
                    <Input
                      aria-label={`كمية ${l.name}`}
                      value={l.qty}
                      onChange={(e) =>
                        patchLine(l.key, { qty: e.target.value })
                      }
                      onFocus={(e) => e.currentTarget.select()}
                      dir="ltr"
                      inputMode="decimal"
                      className="h-9 font-mono"
                    />
                  </td>
                  <td className="px-2">
                    <Input
                      aria-label={`سعر شراء ${l.name}`}
                      value={l.cost}
                      onChange={(e) =>
                        patchLine(l.key, { cost: e.target.value })
                      }
                      onFocus={(e) => e.currentTarget.select()}
                      dir="ltr"
                      inputMode="decimal"
                      className="h-9 font-mono"
                    />
                  </td>
                  <td className="px-2">
                    <Input
                      aria-label={`سعر بيع جديد ${l.name}`}
                      value={l.salePrice}
                      placeholder={String(l.currentPrice)}
                      onChange={(e) =>
                        patchLine(l.key, { salePrice: e.target.value })
                      }
                      dir="ltr"
                      inputMode="decimal"
                      className="h-9 font-mono"
                    />
                  </td>
                  <td className="px-2">
                    <Money amount={lineValue(l)} className="text-sm" />
                  </td>
                  <td className="pe-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`حذف ${l.name}`}
                      onClick={() =>
                        setLines((prev) => prev.filter((x) => x.key !== l.key))
                      }
                    >
                      <IconTrash className="text-destructive" />
                    </Button>
                  </td>
                </MotionTr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1fr_minmax(320px,380px)]">
        <div className="space-y-1.5">
          <Label htmlFor="pf-note">ملاحظة</Label>
          <Input
            id="pf-note"
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
            placeholder="اختياري"
          />
        </div>

        <div className="space-y-2 border bg-card p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              المجموع ({lines.length} صنف)
            </span>
            <Money amount={subtotal} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label
              htmlFor="pf-discount"
              className="font-normal text-muted-foreground"
            >
              خصم المورد
            </Label>
            <Input
              id="pf-discount"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="0"
              dir="ltr"
              inputMode="decimal"
              className="h-8 w-32 font-mono"
            />
          </div>
          <div className="flex items-end justify-between border-t pt-2">
            <span className="pb-0.5 text-sm font-medium">الإجمالي</span>
            <Money amount={total} className="text-2xl leading-none" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="pf-paid" className="font-normal">
              المدفوع الآن من الخزنة
            </Label>
            <Input
              id="pf-paid"
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
              placeholder="0"
              dir="ltr"
              inputMode="decimal"
              className="h-9 w-32 font-mono"
            />
          </div>
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="font-normal"
              onClick={() => setPaid(String(total))}
            >
              دفع كامل
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="font-normal"
              onClick={() => setPaid("")}
            >
              آجل بالكامل
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">يُضاف لحساب المورد</span>
            <Money
              amount={Math.max(remaining, 0)}
              className={remaining > 0 ? "text-warning" : ""}
            />
          </div>

          {submitted && errors.length > 0 && (
            <ul role="alert" className="space-y-0.5 text-destructive">
              {errors.map((e) => (
                <li key={e}>• {e}</li>
              ))}
            </ul>
          )}

          <div className="grid gap-2 pt-1">
            <Button
              size="lg"
              disabled={save.isPending}
              onClick={() => submit(false)}
              className="h-11 gap-2"
            >
              {save.isPending ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                <IconDeviceFloppy className="size-4" />
              )}
              حفظ الفاتورة
              <ShortcutBadge className="border-primary-foreground/30 text-primary-foreground/80">
                {SAVE_KEY.label}
              </ShortcutBadge>
            </Button>
            <Button
              size="lg"
              variant="outline"
              disabled={save.isPending}
              onClick={() => submit(true)}
              className="gap-2 font-normal"
            >
              <IconPlus className="size-4" />
              حفظ وفاتورة جديدة
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
