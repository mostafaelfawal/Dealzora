import "server-only";

import { headers } from "next/headers";

import type { ProductPage, ProductsPage, PublicStore, SortKey } from "./types";

/**
 * قراءات الصفحات على السيرفر (SSR) من سيرفر الفروع داخل الشبكة مباشرة.
 * نمرر عنوان العميل الحقيقي (الذي وضعه Caddy) حتى تُحسب حدود الطلبات لكل زائر لا للمتجر كله.
 */
const BASE = (
  process.env.STORE_API_INTERNAL_URL ?? "http://localhost:8001"
).replace(/\/$/, "");
const SLUG_RE = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,39}$/;
const GID_RE = /^[0-9A-Za-z-]{8,36}$/;

export class NotFoundError extends Error {}

export const validSlug = (slug: string) => SLUG_RE.test(slug);

async function get<T>(path: string): Promise<T> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const res = await fetch(`${BASE}/v1/store/public${path}`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(forwarded ? { "X-Forwarded-For": forwarded } : {}),
    },
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 404) throw new NotFoundError();
  if (!res.ok) throw new Error(`store api ${res.status}`);
  return (await res.json()) as T;
}

export function fetchStore(slug: string): Promise<PublicStore> {
  if (!validSlug(slug)) return Promise.reject(new NotFoundError());
  return get<PublicStore>(`/${slug}`);
}

export function fetchProducts(
  slug: string,
  p: {
    q?: string;
    category?: string;
    sort?: SortKey;
    page?: number;
    pageSize?: number;
  },
): Promise<ProductsPage> {
  const qs = new URLSearchParams();
  if (p.q) qs.set("q", p.q.slice(0, 80));
  if (p.category) qs.set("category", p.category.slice(0, 80));
  if (p.sort && p.sort !== "default") qs.set("sort", p.sort);
  qs.set("page", String(p.page ?? 1));
  qs.set("page_size", String(p.pageSize ?? 24));
  return get<ProductsPage>(`/${slug}/products?${qs}`);
}

export function fetchProduct(slug: string, gid: string): Promise<ProductPage> {
  if (!validSlug(slug) || !GID_RE.test(gid))
    return Promise.reject(new NotFoundError());
  return get<ProductPage>(`/${slug}/products/${gid}`);
}
