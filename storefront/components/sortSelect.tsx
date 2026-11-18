"use client";

import { IconArrowsSort } from "@tabler/icons-react";
import { useRouter, useSearchParams } from "next/navigation";

import type { SortKey } from "@/lib/types";

const OPTIONS: { value: SortKey; label: string }[] = [
  { value: "default", label: "الأنسب" },
  { value: "price_asc", label: "السعر: الأقل أولاً" },
  { value: "price_desc", label: "السعر: الأعلى أولاً" },
  { value: "name", label: "الاسم" },
];

export function SortSelect({ slug, value }: { slug: string; value: SortKey }) {
  const router = useRouter();
  const params = useSearchParams();
  return (
    <label className="relative flex h-9 items-center border bg-background text-sm">
      <IconArrowsSort className="pointer-events-none absolute inset-s-2.5 size-4 text-muted-foreground" />
      <span className="sr-only">ترتيب الأصناف</span>
      <select
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          if (e.target.value === "default") next.delete("sort");
          else next.set("sort", e.target.value);
          const qs = next.toString();
          router.push(`/${slug}${qs ? `?${qs}` : ""}#products`, { scroll: false });
        }}
        className="h-full cursor-pointer appearance-none bg-transparent ps-8 pe-3 outline-none"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
