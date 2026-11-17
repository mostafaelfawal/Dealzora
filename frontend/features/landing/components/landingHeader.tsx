"use client";

import { IconDownload, IconMenu2 } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { ThemeToggle } from "@/components/layout/header/ThemeToggle";
import { BrandLogo } from "@/components/shared/BrandLogo";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import { NAV_LINKS } from "../config/site";
import { Container, ctaClass } from "./primitives";

export function LandingHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  // حدّ سفلي يظهر فقط بعد بدء التمرير، فيندمج الرأس مع الواجهة في أعلى الصفحة.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b bg-background/90 backdrop-blur-sm transition-colors supports-backdrop-filter:bg-background/75",
        scrolled ? "border-border" : "border-transparent",
      )}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:right-2 focus:z-50 focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        تخطَّ إلى المحتوى
      </a>
      <Container className="flex h-16 items-center gap-4">
        <Link
          href="/#top"
          className="flex shrink-0 items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Dealzora — الصفحة الرئيسية"
        >
          <BrandLogo variant="icon" className="size-8" />
          <span className="text-lg font-bold tracking-tight" dir="ltr">
            Dealzora
          </span>
        </Link>

        <nav aria-label="التنقل الرئيسي" className="mx-auto hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={link.href === pathname ? "page" : undefined}
                  className="inline-flex h-9 items-center px-3 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:font-semibold aria-[current=page]:text-foreground"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ms-auto flex items-center gap-1 lg:ms-0">
          <ThemeToggle />
          <Link
            href="/#download"
            className={cn(ctaClass(), "hidden sm:inline-flex")}
          >
            <IconDownload aria-hidden />
            حمّل البرنامج
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="فتح القائمة"
            aria-expanded={open}
            className="inline-flex size-10 items-center justify-center outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
          >
            <IconMenu2 className="size-5" aria-hidden />
          </button>
        </div>
      </Container>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[85vw] max-w-sm gap-0 p-0">
          <div className="flex h-16 items-center gap-2.5 border-b px-5">
            <BrandLogo variant="icon" className="size-7" />
            <SheetTitle className="text-base font-bold" dir="ltr">
              Dealzora
            </SheetTitle>
            <SheetDescription className="sr-only">
              روابط أقسام الصفحة
            </SheetDescription>
          </div>
          <nav aria-label="التنقل في الهاتف" className="flex-1 overflow-y-auto">
            <ul className="divide-y border-b">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={link.href === pathname ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className="flex h-14 items-center px-5 text-base outline-none hover:bg-muted focus-visible:bg-muted"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="border-t p-5">
            <Link
              href="/#download"
              onClick={() => setOpen(false)}
              className={cn(ctaClass("default", "lg"), "w-full")}
            >
              <IconDownload aria-hidden />
              حمّل البرنامج
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
