import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";

import { fetchStore, NotFoundError } from "@/lib/api";

/** المتجر مرة واحدة لكل طلب صفحة (التخطيط والصفحة يطلبانه معاً). */
export const getStore = cache(async (slug: string) => {
  try {
    return await fetchStore(slug);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
});

export async function orNotFound<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
}
