"use client";

import { IconLoader2, IconSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { Money } from "@/components/shared/Money";
import { Input } from "@/components/ui/input";
import { getProducts } from "@/features/products/api/products.api";
import { productKeys } from "@/features/products/config/productQueryKeys";
import type { Product } from "@/features/products/types/product";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const MAX_RESULTS = 6;

/**
 * حقل «ماذا اشترى؟»: نص حر، ومع الكتابة تظهر أصناف المحل المطابقة.
 * اختيار صنف يكتب اسمه ويعبّئ سعر بيعه (يبقى قابلاً للتعديل).
 */
export function ProductTitleInput({
  value,
  onChange,
  onPick,
  placeholder,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (p: Product) => void;
  placeholder?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const q = useDebouncedValue(value.trim(), 250);
  const params = { q, page: 1, page_size: MAX_RESULTS };
  const query = useQuery({
    queryKey: productKeys.list(params),
    queryFn: () => getProducts(params),
    enabled: open && q.length > 0,
    staleTime: 30_000,
  });
  const results = (query.data?.items ?? []).filter((p) => p.isActive);
  const showList = open && q.length > 0 && results.length > 0;

  return (
    <div className="relative">
      <IconSearch className="pointer-events-none absolute inset-s-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // تأخير بسيط حتى يُسجَّل الضغط على الصنف قبل إغلاق القائمة.
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder={placeholder}
        maxLength={80}
        autoComplete="off"
        aria-label="ماذا اشترى؟"
        aria-invalid={invalid || undefined}
        className="h-10 ps-8 pe-8"
      />
      {open && query.isFetching && q.length > 0 && (
        <IconLoader2 className="absolute inset-e-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
      {showList && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 divide-y overflow-y-auto border bg-popover shadow-md">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(p);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 p-2 text-start text-sm hover:bg-muted"
              >
                <AppTooltip message={p.name} onlyWhenTruncated>
                  <span className="flex-1 truncate">{p.name}</span>
                </AppTooltip>
                <span className="shrink-0 text-xs text-muted-foreground">
                  متوفر {p.stock}
                </span>
                <Money amount={p.salePrice} className="shrink-0 text-xs" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
