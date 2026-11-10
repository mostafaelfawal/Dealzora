"use client";

import {
  IconLoader2,
  IconPackage,
  IconPlus,
  IconReceipt,
  IconSearch,
  IconShoppingCartPlus,
  IconTruckDelivery,
  IconUser,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Money } from "@/components/shared/Money";
import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { getNavigationForRole } from "@/config/navigation";
import { SHORTCUTS } from "@/config/shortcuts";
import { getProducts } from "@/features/products/api/products.api";
import { PRODUCT_ROUTES } from "@/features/products/config/productRoutes";
import { fetchSales } from "@/features/sales/api/sales.api";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useHotkey } from "@/hooks/useHotkey";
import { useSessionUser } from "@/hooks/useShellData";
import { api } from "@/lib/axios";
import { toPounds } from "@/lib/apiMap";
import { formatQty, normalizeDigits } from "@/lib/format";

const QUICK_ACTIONS = [
  {
    title: "بيع جديد",
    href: "/pos",
    icon: IconShoppingCartPlus,
    shortcut: SHORTCUTS.newSale.label,
  },
  { title: "إضافة صنف", href: "/admin/products/new", icon: IconPlus },
  {
    title: "فاتورة شراء جديدة",
    href: "/admin/purchases/new",
    icon: IconTruckDelivery,
  },
  { title: "إضافة مورد", href: "/admin/suppliers/new", icon: IconPlus },
];

const RESULT_LIMIT = 5;

interface CustomerHit {
  id: string;
  name: string;
  phone: string | null;
  balance: number;
}

async function searchAll(term: string) {
  const digits = normalizeDigits(term).replace(/^#/, "");
  const isNumber = /^\d{1,7}$/.test(digits);
  const [products, customers, sales] = await Promise.all([
    getProducts({ q: term, page: 1, page_size: RESULT_LIMIT }),
    api
      .get<{ items: CustomerHit[] }>("/customers", {
        params: { q: term, page: 1, page_size: RESULT_LIMIT },
      })
      .then((r) => r.data.items),
    isNumber
      ? fetchSales({ q: digits, page: 1, pageSize: 3 }).then((r) => r.items)
      : Promise.resolve([]),
  ]);
  return { products: products.items, customers, sales };
}

/**
 * بحث شامل (Ctrl+K): إجراءات سريعة + صفحات + نتائج حية من الأصناف والعملاء والفواتير.
 * رقم وحده = يبحث عن فاتورة بنفس الرقم.
 */
export function GlobalSearch() {
  const router = useRouter();
  const user = useSessionUser();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const debounced = useDebouncedValue(term.trim(), 250);

  const results = useQuery({
    queryKey: ["global-search", debounced],
    queryFn: () => searchAll(debounced),
    enabled: open && debounced.length >= 2,
    staleTime: 15_000,
  });

  const pages = getNavigationForRole(user.role).flatMap((group) => group.items);

  useHotkey(SHORTCUTS.globalSearch.match, () => setOpen((prev) => !prev));

  function go(href: string) {
    setOpen(false);
    setTerm("");
    router.push(href);
  }

  const data = results.data;
  const keywords = [term];

  return (
    <>
      <Button
        variant="outline"
        size="lg"
        onClick={() => setOpen(true)}
        aria-label="بحث شامل"
        className="w-9 justify-center px-0 font-normal text-muted-foreground sm:w-full sm:max-w-sm sm:justify-start sm:gap-2 sm:px-2.5"
      >
        <IconSearch className="size-4 shrink-0" />
        <span className="hidden flex-1 truncate text-start sm:inline">
          ابحث عن صنف أو عميل أو رقم فاتورة
        </span>
        <ShortcutBadge className="hidden lg:inline-flex">
          {SHORTCUTS.globalSearch.label}
        </ShortcutBadge>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setTerm("");
        }}
        className="sm:max-w-lg"
        title="بحث شامل"
        description="ابحث عن صنف أو عميل أو فاتورة، أو انتقل لأي صفحة"
      >
        <CommandInput
          placeholder="اسم صنف، باركود، عميل، أو رقم فاتورة…"
          value={term}
          onValueChange={setTerm}
        />
        <CommandList className="max-h-[60dvh]">
          <CommandEmpty>
            {results.isFetching ? (
              <span className="inline-flex items-center gap-2">
                <IconLoader2 className="size-4 animate-spin" /> جارٍ البحث…
              </span>
            ) : (
              "لا توجد نتائج مطابقة"
            )}
          </CommandEmpty>

          {data && data.sales.length > 0 && (
            <CommandGroup heading="الفواتير">
              {data.sales.map((s) => (
                <CommandItem
                  key={s.id}
                  value={`sale-${s.id}`}
                  keywords={keywords}
                  onSelect={() => go(`/admin/sales?open=${s.id}`)}
                >
                  <IconReceipt className="size-4" />
                  <span className="font-mono">#{s.number}</span>
                  <span className="truncate text-muted-foreground">
                    {s.customerName ?? "عميل نقدي"}
                  </span>
                  <Money amount={s.total} className="ms-auto text-xs" />
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {data && data.products.length > 0 && (
            <CommandGroup heading="الأصناف">
              {data.products.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`product-${p.id}`}
                  keywords={keywords}
                  onSelect={() => go(PRODUCT_ROUTES.edit(p.id))}
                >
                  <IconPackage className="size-4" />
                  <span className="truncate">{p.name}</span>
                  <span className="ms-auto flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>
                      رصيد {formatQty(p.stock)} {p.unit}
                    </span>
                    <Money amount={p.salePrice} className="text-xs" />
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {data && data.customers.length > 0 && (
            <CommandGroup heading="العملاء">
              {data.customers.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`customer-${c.id}`}
                  keywords={keywords}
                  onSelect={() =>
                    go(
                      `/admin/customers?q=${encodeURIComponent(c.phone ?? c.name)}`,
                    )
                  }
                >
                  <IconUser className="size-4" />
                  <span className="truncate">{c.name}</span>
                  {c.phone && (
                    <span
                      dir="ltr"
                      className="font-mono text-[11px] text-muted-foreground"
                    >
                      {c.phone}
                    </span>
                  )}
                  {c.balance > 0 && (
                    <span className="ms-auto text-[11px] text-destructive">
                      عليه{" "}
                      <Money
                        amount={toPounds(c.balance)}
                        className="text-[11px]"
                      />
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandGroup heading="إجراءات سريعة">
            {QUICK_ACTIONS.map(({ title, href, icon: Icon, shortcut }) => (
              <CommandItem key={href} onSelect={() => go(href)}>
                <Icon className="size-4" />
                <span>{title}</span>
                {shortcut && (
                  <ShortcutBadge className="ms-auto">{shortcut}</ShortcutBadge>
                )}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="الصفحات">
            {pages.map(({ title, href, icon: Icon, hotkey }) => (
              <CommandItem key={href} onSelect={() => go(href)}>
                <Icon className="size-4" />
                <span>{title}</span>
                {hotkey !== undefined && (
                  <ShortcutBadge className="ms-auto">
                    Alt {hotkey}
                  </ShortcutBadge>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
