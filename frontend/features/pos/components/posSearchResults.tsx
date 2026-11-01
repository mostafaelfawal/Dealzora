"use client";

import { useEffect } from "react";

import { Money } from "@/components/shared/Money";
import { cn } from "cn";
import type { PosProduct } from "../types/pos";

import { PosStockBadge } from "./posStockBadge";

export const posOptionId = (productId: string) => `pos-option-${productId}`;

interface PosSearchResultsProps {
  term: string;
  results: PosProduct[];
  activeIndex: number;
  onHover: (index: number) => void;
  onAdd: (product: PosProduct) => void;
}

/** نتايج البحث كقائمة (listbox). التنقل بالأسهم من خانة البحث نفسها. */
export function PosSearchResults({
  term,
  results,
  activeIndex,
  onHover,
  onAdd,
}: PosSearchResultsProps) {
  const activeId = results[activeIndex]
    ? posOptionId(results[activeIndex].id)
    : null;

  useEffect(() => {
    if (activeId) {
      document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
    }
  }, [activeId]);

  if (results.length === 0) {
    return (
      <div className="space-y-1 py-6 text-xs">
        <p className="text-sm font-medium">مفيش صنف مطابق لـ «{term}»</p>
        <p className="text-muted-foreground">
          جرّب جزء من الاسم، أو آخر أرقام الباركود.
        </p>
      </div>
    );
  }

  return (
    <ul
      id="pos-results"
      role="listbox"
      aria-label="نتائج البحث"
      className="border"
    >
      {results.map((product, index) => {
        const active = index === activeIndex;
        return (
          <li
            key={product.id}
            id={posOptionId(product.id)}
            role="option"
            aria-selected={active}
            onMouseMove={() => !active && onHover(index)}
            className={cn(
              "relative border-b last:border-b-0",
              active && "bg-muted",
            )}
          >
            {active && (
              <span
                aria-hidden
                className="absolute inset-y-0 inset-s-0 w-0.5 bg-primary"
              />
            )}
            <button
              type="button"
              tabIndex={-1}
              onClick={() => onAdd(product)}
              className="flex h-12 w-full items-center gap-3 px-3 text-start outline-none"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {product.name}
                </span>
                <span
                  dir="ltr"
                  className="block text-start font-mono text-[11px] text-muted-foreground"
                >
                  {product.barcode}
                </span>
              </span>
              <PosStockBadge product={product} />
              <span className="flex items-baseline gap-1">
                <Money amount={product.price} className="text-sm" />
                <span className="text-[11px] text-muted-foreground">
                  / {product.unit}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
