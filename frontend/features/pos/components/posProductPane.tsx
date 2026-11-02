"use client";

import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { cn } from "cn";
import { posUiActions } from "../store/posUiSlice";
import {
  selectCategories,
  selectIsSearching,
  selectVisibleProducts,
} from "../store/selectors";

import { PosProductCard } from "./posProductCard";
import { PosSearchInput } from "./posSearchInput";
import { PosSearchResults } from "./posSearchResults";

/** العمود الأول: بحث + تصنيفات + بطاقات الأصناف (أو نتائج البحث). */
export function PosProductPane({ className }: { className?: string }) {
  const dispatch = useAppDispatch();
  const searching = useAppSelector(selectIsSearching);
  const category = useAppSelector((s) => s.posUi.category);
  const categories = useAppSelector(selectCategories);
  const visible = useAppSelector(selectVisibleProducts);

  return (
    <section
      aria-label="الأصناف"
      className={cn("min-h-0 flex-col lg:border-e", className)}
    >
      <div className="shrink-0 space-y-2 border-b p-3">
        <PosSearchInput />

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
                onClick={() => dispatch(posUiActions.setCategory(c.id))}
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
          <PosSearchResults />
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visible.map((product) => (
              <PosProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
