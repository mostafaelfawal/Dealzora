import { BrandLogo } from "@/components/shared/BrandLogo";
import Link from "next/link";

import {
  DOWNLOADS,
  isDownloadReady,
  NAV_LINKS,
  RELEASES_URL,
  SOCIAL_LINKS,
} from "../config/site";
import { BrandIcon, Container, external } from "./primitives";

const linkClass =
  "text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:underline";

export function LandingFooter() {
  const windows = DOWNLOADS.windows;
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/40">
      <Container className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <BrandLogo variant="icon" className="size-8" />
            <span className="text-lg font-bold" dir="ltr">
              Dealzora
            </span>
          </div>
          <p className="max-w-sm text-sm leading-7 text-muted-foreground">
            برنامج لإدارة المحلات التجارية: نقطة البيع والمخزون والمشتريات
            والعملاء والموردون والخزنة والتقارير في مكان واحد.
          </p>
          <ul className="flex flex-wrap gap-2" aria-label="حسابات Dealzora">
            {SOCIAL_LINKS.map((s) => (
              <li key={s.name}>
                <a
                  href={s.url}
                  {...external}
                  aria-label={s.label}
                  title={s.name}
                  className="flex size-10 items-center justify-center border bg-background text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <BrandIcon icon={s.icon} className="size-4" />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <nav aria-label="روابط الصفحة" className="space-y-4">
          <h2 className="text-sm font-semibold">روابط سريعة</h2>
          <ul className="space-y-2.5">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={linkClass}>
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/#faq" className={linkClass}>
                الأسئلة الشائعة
              </Link>
            </li>
          </ul>
        </nav>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold">التحميل</h2>
          <ul className="space-y-2.5">
            {isDownloadReady(windows) && (
              <li>
                <a href={windows.url} className={linkClass}>
                  Dealzora لويندوز{" "}
                  <span dir="ltr" className="font-mono text-xs">
                    v{windows.version}
                  </span>
                </a>
              </li>
            )}
            <li>
              <a href={RELEASES_URL} {...external} className={linkClass}>
                كل الإصدارات
              </a>
            </li>
            <li>
              <Link href="/#download" className={linkClass}>
                تطبيق الهاتف
              </Link>
            </li>
          </ul>
        </div>
      </Container>

      <div className="border-t">
        <Container className="flex flex-col gap-2 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © <span dir="ltr">{year} Dealzora</span>. جميع الحقوق محفوظة.
          </p>
          <p>صُنع بعناية للتجار العرب.</p>
        </Container>
      </div>
    </footer>
  );
}
