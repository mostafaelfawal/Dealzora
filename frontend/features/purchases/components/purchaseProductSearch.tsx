"use client";

import { IconBarcode } from "@tabler/icons-react";
import { useMemo, useState, type KeyboardEvent, type RefObject } from "react";

import { Money } from "@/components/shared/Money";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import type { Product } from "@/features/products/types/product";
import { formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

import { usePurchaseProducts } from "../hooks/usePurchases";
import { searchProducts } from "../lib/purchaseDraft";

function ResultRow({
  product: p,
  active,
  onHover,
  onPick,
}: {
  product: Product;
  active: boolean;
  onHover: () => void;
  onPick: () => void;
}) {
  return (
    <li
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      onMouseDown={(e) => {
        // mouseDown بدل click حتى لا يفقد حقل البحث التركيز قبل الاختيار.
        e.preventDefault();
        onPick();
      }}
      className={cn(
        "flex cursor-pointer items-center gap-3 px-3 py-2 text-sm",
        active && "bg-muted",
      )}
    >
      <span className="min-w-0 flex-1 truncate">{p.name}</span>
      <span className="text-[11px] text-muted-foreground">
        رصيد {formatQty(p.stock)} {p.unit}
      </span>
      <span className="text-[11px] text-muted-foreground">
        شراء <Money amount={p.costPrice ?? 0} className="text-[11px]" />
      </span>
    </li>
  );
}

/** إضافة صنف بالباركود أو بالاسم: الأسهم للتنقل، Enter للإضافة، Esc للمسح. */
export function PurchaseProductSearch({
  inputRef,
  onPick,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  onPick: (product: Product) => void;
}) {
  const products = usePurchaseProducts();
  const [term, setTerm] = useState("");
  const [active, setActive] = useState(0);

  const results = useMemo(
    () => searchProducts(products.data ?? [], term),
    [products.data, term],
  );

  function pick(p: Product) {
    onPick(p);
    setTerm("");
    setActive(0);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!results.length) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      // مسح باركود كامل يتقدّم على ترتيب النتائج.
      const exact = products.data?.find((p) => p.barcode === term.trim());
      const choice = exact ?? results[Math.min(active, results.length - 1)];
      if (choice) pick(choice);
    } else if (e.key === "Escape" && term) {
      e.preventDefault();
      setTerm("");
    }
  }

  return (
    <section className="relative">
      <InputGroup className="h-12">
        <InputGroupAddon>
          <IconBarcode />
        </InputGroupAddon>
        <InputGroupInput
          ref={inputRef}
          autoFocus
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
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
              <ResultRow
                key={p.id}
                product={p}
                active={i === active}
                onHover={() => setActive(i)}
                onPick={() => pick(p)}
              />
            ))
          )}
        </ul>
      )}
    </section>
  );
}
