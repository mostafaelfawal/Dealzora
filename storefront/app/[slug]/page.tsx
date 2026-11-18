import {
  IconCash,
  IconClock,
  IconMapPin,
  IconStarFilled,
  IconTruckDelivery,
} from "@tabler/icons-react";
import Link from "next/link";
import { Suspense } from "react";

import { ProductCard } from "@/components/productCard";
import { ProductGrid } from "@/components/productGrid";
import { SortSelect } from "@/components/sortSelect";
import { StoreLogo } from "@/components/storeLogo";
import { fetchProducts } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { SortKey } from "@/lib/types";
import { cn } from "@/lib/utils";

import { getStore, orNotFound } from "./data";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const SORTS: SortKey[] = ["default", "price_asc", "price_desc", "name"];
const one = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v)?.slice(0, 80) || undefined;

export default async function StorePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const q = one(sp.q)?.trim() || undefined;
  const category = one(sp.category);
  const rawSort = one(sp.sort) as SortKey | undefined;
  const sort: SortKey = rawSort && SORTS.includes(rawSort) ? rawSort : "default";

  const store = await getStore(slug);
  const page = await orNotFound(fetchProducts(slug, { q, category, sort, pageSize: 24 }));
  const browsing = !q && !category;
  const catHref = (c?: string) => {
    const qs = new URLSearchParams();
    if (c) qs.set("category", c);
    if (sort !== "default") qs.set("sort", sort);
    const s = qs.toString();
    return `/${slug}${s ? `?${s}` : ""}#products`;
  };

  const chips = [
    store.delivery_fee === 0
      ? { icon: <IconTruckDelivery />, text: "توصيل مجاني" }
      : {
          icon: <IconTruckDelivery />,
          text:
            store.free_delivery_over !== null
              ? `توصيل ${formatMoney(store.delivery_fee, store.currency)} · مجاني من ${formatMoney(store.free_delivery_over, store.currency)}`
              : `توصيل ${formatMoney(store.delivery_fee, store.currency)}`,
        },
    { icon: <IconCash />, text: "الدفع عند الاستلام" },
    ...(store.hours ? [{ icon: <IconClock />, text: store.hours }] : []),
    ...(store.city ? [{ icon: <IconMapPin />, text: store.city }] : []),
  ];

  return (
    <div className="space-y-8">
      {browsing && (
        <section className="relative overflow-hidden border bg-card">
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:28px_28px]"
          />
          <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-8">
            <StoreLogo url={store.logo_url} name={store.name} className="size-20 sm:size-24" />
            <div className="min-w-0 flex-1 space-y-2">
              <h1 className="text-2xl font-bold sm:text-3xl">{store.name}</h1>
              {store.tagline && <p className="text-muted-foreground sm:text-lg">{store.tagline}</p>}
              <ul className="flex flex-wrap gap-1.5 pt-1">
                {chips.map((c) => (
                  <li
                    key={c.text}
                    className="flex items-center gap-1.5 border bg-background/80 px-2.5 py-1 text-xs [&_svg]:size-3.5"
                  >
                    {c.icon}
                    {c.text}
                  </li>
                ))}
              </ul>
              {store.min_order > 0 && (
                <p className="text-xs text-muted-foreground">
                  أقل قيمة للطلب {formatMoney(store.min_order, store.currency)}
                </p>
              )}
            </div>
          </div>
          {store.about && (
            <p className="relative border-t px-5 py-3 text-sm whitespace-pre-line text-muted-foreground sm:px-8">
              {store.about}
            </p>
          )}
        </section>
      )}

      {browsing && store.featured.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <IconStarFilled className="size-5 text-warning" />
            مختارات المتجر
          </h2>
          <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
            {store.featured.map((p) => (
              <div key={p.gid} className="w-44 shrink-0 snap-start sm:w-52">
                <ProductCard p={p} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section id="products" className="scroll-mt-24 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-bold">
            {q ? `نتائج «${q}»` : (category ?? "كل الأصناف")}
            <span className="ms-2 text-sm font-normal text-muted-foreground">{page.total} صنف</span>
          </h2>
          <div className="ms-auto">
            <Suspense>
              <SortSelect slug={slug} value={sort} />
            </Suspense>
          </div>
        </div>

        {store.categories.length > 1 && !q && (
          <nav aria-label="التصنيفات" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {[{ name: undefined, label: "الكل", count: store.products_count }, ...store.categories.map((c) => ({ name: c.name, label: c.name, count: c.count }))].map(
              (c) => {
                const active = c.name === category;
                return (
                  <Link
                    key={c.label}
                    href={catHref(c.name)}
                    scroll={false}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-9 shrink-0 items-center gap-1.5 border px-3 text-sm transition-colors",
                      active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                    )}
                  >
                    {c.label}
                    <span className={cn("font-mono text-[11px]", active ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      {c.count}
                    </span>
                  </Link>
                );
              },
            )}
          </nav>
        )}

        <ProductGrid key={`${q}|${category}|${sort}`} initial={page} filters={{ q, category, sort }} />
      </section>
    </div>
  );
}
