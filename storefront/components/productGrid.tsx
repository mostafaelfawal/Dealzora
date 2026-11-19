"use client";

import { IconLoader2, IconMoodEmpty } from "@tabler/icons-react";
import { useState } from "react";

import { ApiError, storeApi } from "@/lib/client";
import type { ProductsPage, PublicProduct, SortKey } from "@/lib/types";

import { ProductCard } from "./productCard";
import { useStore } from "./storeContext";
import { Button, ButtonLink } from "./ui";

/** شبكة الأصناف: الصفحة الأولى من السيرفر، والباقي «تحميل المزيد» بلا إعادة تحميل الصفحة. */
export function ProductGrid({
  initial,
  filters,
}: {
  initial: ProductsPage;
  filters: { q?: string; category?: string; sort: SortKey };
}) {
  const store = useStore();
  const [items, setItems] = useState<PublicProduct[]>(initial.items);
  const [page, setPage] = useState(initial.page);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const more = items.length < initial.total;

  async function loadMore() {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    if (filters.q) qs.set("q", filters.q);
    if (filters.category) qs.set("category", filters.category);
    if (filters.sort !== "default") qs.set("sort", filters.sort);
    qs.set("page", String(page + 1));
    qs.set("page_size", String(initial.page_size));
    try {
      const next = await storeApi<ProductsPage>(store.slug, `/products?${qs}`);
      setItems((cur) => {
        const seen = new Set(cur.map((p) => p.gid));
        return [...cur, ...next.items.filter((p) => !seen.has(p.gid))];
      });
      setPage(next.page);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "تعذّر تحميل المزيد");
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0)
    return (
      <div className="flex flex-col items-center gap-3 border border-dashed p-12 text-center">
        <IconMoodEmpty className="size-10 text-muted-foreground" />
        <p className="font-medium">
          {filters.q ? `لا نتائج لـ «${filters.q}»` : "لا أصناف هنا بعد"}
        </p>
        <p className="text-sm text-muted-foreground">
          جرّب كلمة أبسط أو تصفّح كل الأصناف.
        </p>
        {(filters.q || filters.category) && (
          <ButtonLink
            href={`/${store.slug}#products`}
            variant="outline"
            size="sm"
          >
            كل الأصناف
          </ButtonLink>
        )}
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((p) => (
          <ProductCard key={p.gid} p={p} />
        ))}
      </div>
      {more && (
        <div className="flex flex-col items-center gap-2">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={loading}
            className="min-w-44"
          >
            {loading ? <IconLoader2 className="animate-spin" /> : null}
            عرض المزيد ({initial.total - items.length})
          </Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}
