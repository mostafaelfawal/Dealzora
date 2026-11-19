"use client";

import { IconSearch, IconShoppingBag, IconX } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";

import { StoreLogo } from "./storeLogo";
import { useStore } from "./storeContext";
import { ThemeToggle } from "./themeToggle";
import { buttonClass } from "./ui";

/** رأس ثابت: الشعار والاسم، والبحث، والسلة بعددها. */
export function StoreHeader({
  logoUrl,
  allowThemeToggle = true,
}: {
  logoUrl: string | null;
  /** التاجر ثبّت الوضع (فاتح/داكن): لا زر تبديل. */
  allowThemeToggle?: boolean;
}) {
  const store = useStore();
  const cart = useCart(store.slug);
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  function submit(e: FormEvent) {
    e.preventDefault();
    const text = q.trim();
    router.push(
      text ? `/${store.slug}?q=${encodeURIComponent(text)}#products` : `/${store.slug}#products`,
    );
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link
          href={`/${store.slug}`}
          className="flex min-w-0 items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <StoreLogo url={logoUrl} name={store.name} className="size-9" />
          <span className="truncate font-bold max-sm:max-w-[9rem]">
            {store.name}
          </span>
        </Link>

        <form
          onSubmit={submit}
          role="search"
          className="relative ms-auto hidden max-w-sm flex-1 md:block"
        >
          <IconSearch className="pointer-events-none absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث عن منتج"
            aria-label="بحث في المتجر"
            maxLength={80}
            className="h-10 w-full border border-input bg-muted/40 ps-9 pe-8 text-sm outline-none transition focus-visible:border-ring focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          {q && (
            <button
              type="button"
              aria-label="مسح البحث"
              onClick={() => {
                setQ("");
                router.push(`/${store.slug}#products`);
              }}
              className="absolute inset-e-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <IconX className="size-4" />
            </button>
          )}
        </form>

        <div className="ms-auto flex items-center gap-1 md:ms-0">
          {allowThemeToggle && <ThemeToggle />}
          <Link
            href={`/${store.slug}/cart`}
            className={cn(buttonClass("default", "md"), "relative")}
            aria-label={`السلة${cart.count ? `: ${cart.count} صنف` : ""}`}
          >
            <IconShoppingBag />
            <span className="max-sm:hidden">السلة</span>
            {cart.count > 0 && (
              <span className="flex min-w-5 items-center justify-center bg-primary-foreground px-1 font-mono text-[11px] leading-5 text-primary tabular-nums">
                {cart.count}
              </span>
            )}
          </Link>
        </div>
      </div>

      <form onSubmit={submit} role="search" className="px-4 pb-3 md:hidden">
        <div className="relative">
          <IconSearch className="pointer-events-none absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث عن منتج"
            aria-label="بحث في المتجر"
            maxLength={80}
            className="h-10 w-full border border-input bg-muted/40 ps-9 text-sm outline-none focus-visible:border-ring focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>
      </form>
    </header>
  );
}
