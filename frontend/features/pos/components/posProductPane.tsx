"use client";

import type { KeyboardEvent, RefObject } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "cn";
import type { PosCategory, PosProduct } from "../types/pos";

import { PosProductCard } from "./posProductCard";
import { PosSearchInput } from "./posSearchInput";
import { PosSearchResults, posOptionId } from "./posSearchResults";

interface PosProductPaneProps {
  className?: string;
  inputRef: RefObject<HTMLInputElement | null>;
  query: string;
  onQueryChange: (value: string) => void;
  onSearchKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  notFound: string | null;
  pendingQty: number | null;
  searchTerm: string;
  results: PosProduct[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  products: PosProduct[];
  categories: PosCategory[];
  category: string;
  onCategoryChange: (id: string) => void;
  onAdd: (product: PosProduct) => void;
}

/** العمود الأول: بحث + تصنيفات + كروت الأصناف (أو نتايج البحث). */
export function PosProductPane({
  className,
  inputRef,
  query,
  onQueryChange,
  onSearchKeyDown,
  notFound,
  pendingQty,
  searchTerm,
  results,
  activeIndex,
  onActiveIndexChange,
  products,
  categories,
  category,
  onCategoryChange,
  onAdd,
}: PosProductPaneProps) {
  const searching = searchTerm !== "";
  const visible =
    category === "all"
      ? products
      : products.filter((p) => p.category === category);
  const activeProduct = results[activeIndex];

  return (
    <section
      aria-label="الأصناف"
      className={cn("min-h-0 flex-col lg:border-e", className)}
    >
      <div className="shrink-0 space-y-2 border-b p-3">
        <PosSearchInput
          inputRef={inputRef}
          value={query}
          onChange={onQueryChange}
          onKeyDown={onSearchKeyDown}
          expanded={searching && results.length > 0}
          activeOptionId={
            searching && activeProduct
              ? posOptionId(activeProduct.id)
              : undefined
          }
          notFound={notFound}
          pendingQty={pendingQty}
        />

        {!searching && (
          <div
            role="group"
            aria-label="التصنيفات"
            className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3"
          >
            {[{ id: "all", label: "الكل" }, ...categories].map((c) => (
              <Button
                key={c.id}
                type="button"
                size="sm"
                variant={category === c.id ? "default" : "outline"}
                aria-pressed={category === c.id}
                onClick={() => onCategoryChange(c.id)}
                className="shrink-0 font-normal"
              >
                {c.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {searching ? (
          <PosSearchResults
            term={searchTerm}
            results={results}
            activeIndex={activeIndex}
            onHover={onActiveIndexChange}
            onAdd={onAdd}
          />
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visible.map((product) => (
              <PosProductCard
                key={product.id}
                product={product}
                onAdd={onAdd}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
