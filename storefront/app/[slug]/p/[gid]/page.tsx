import {
  IconArrowRight,
  IconCash,
  IconTruckDelivery,
} from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Price } from "@/components/price";
import { ProductActions } from "@/components/productActions";
import { ProductCard } from "@/components/productCard";
import { ProductGallery } from "@/components/productGallery";
import { fetchProduct } from "@/lib/api";
import { formatMoney } from "@/lib/format";

import { getStore, orNotFound } from "../../data";

type Props = { params: Promise<{ slug: string; gid: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, gid } = await params;
  const store = await getStore(slug);
  const { product } = await orNotFound(fetchProduct(slug, gid));
  const description =
    product.description?.slice(0, 160) ??
    `${product.name} بسعر ${formatMoney(product.price, store.currency)} من ${store.name}. الدفع عند الاستلام.`;
  return {
    title: product.name,
    description,
    alternates: { canonical: `/${slug}/p/${gid}` },
    openGraph: {
      title: product.name,
      description,
      ...(product.images.length
        ? { images: product.images.map((url) => ({ url })) }
        : {}),
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug, gid } = await params;
  const store = await getStore(slug);
  const { product: p, related } = await orNotFound(fetchProduct(slug, gid));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    ...(p.images.length ? { image: p.images } : {}),
    ...(p.description ? { description: p.description } : {}),
    ...(p.barcode ? { gtin: p.barcode } : {}),
    offers: {
      "@type": "Offer",
      price: (p.price / 100).toFixed(2),
      availability: p.available
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div className="space-y-10">
      <script
        type="application/ld+json"
        // JSON.stringify آمن هنا: نهرب "<" حتى لا يُغلق الوسم من داخل نص الصنف.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <nav
        aria-label="مسار التصفح"
        className="flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Link
          href={`/${slug}`}
          className="flex items-center gap-1 hover:text-foreground"
        >
          <IconArrowRight className="size-4" />
          {store.name}
        </Link>
        {p.category && (
          <>
            <span>/</span>
            <Link
              href={`/${slug}?category=${encodeURIComponent(p.category)}#products`}
              className="hover:text-foreground"
            >
              {p.category}
            </Link>
          </>
        )}
      </nav>

      <article className="grid gap-6 md:grid-cols-2 md:gap-10">
        <ProductGallery
          images={p.images.length ? p.images : p.image_url ? [p.image_url] : []}
          name={p.name}
        />
        <div className="flex flex-col gap-5">
          <div className="space-y-2">
            {p.category && (
              <p className="text-sm text-muted-foreground">{p.category}</p>
            )}
            <h1 className="text-2xl leading-tight font-bold sm:text-3xl">
              {p.name}
            </h1>
            <div className="flex items-baseline gap-2">
              <Price
                cents={p.price}
                currency={store.currency}
                className="text-3xl"
              />
              <span className="text-sm text-muted-foreground">/ {p.unit}</span>
            </div>
            {p.low_stock && p.available && (
              <p className="text-sm font-medium text-warning">
                كمية محدودة متبقية
              </p>
            )}
          </div>

          <ProductActions p={p} />

          <ul className="space-y-2 border-y py-4 text-sm">
            <li className="flex items-center gap-2">
              <IconTruckDelivery className="size-5 text-muted-foreground" />
              {store.delivery_fee === 0
                ? "توصيل مجاني"
                : `رسوم التوصيل ${formatMoney(store.delivery_fee, store.currency)}${
                    store.free_delivery_over !== null
                      ? ` · مجاني للطلبات من ${formatMoney(store.free_delivery_over, store.currency)}`
                      : ""
                  }`}
            </li>
            <li className="flex items-center gap-2">
              <IconCash className="size-5 text-muted-foreground" />
              الدفع نقداً عند الاستلام
            </li>
          </ul>

          {p.description && (
            <section className="space-y-2">
              <h2 className="font-bold">عن المنتج</h2>
              <p className="text-sm leading-7 whitespace-pre-line text-muted-foreground">
                {p.description}
              </p>
            </section>
          )}
        </div>
      </article>

      {related.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">من نفس التصنيف</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((r) => (
              <ProductCard key={r.gid} p={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
