import {
  IconArrowDown,
  IconDatabaseExport,
  IconDownload,
  IconGift,
  IconWifiOff,
} from "@tabler/icons-react";

import { DOWNLOADS } from "../config/site";
import { Container, ctaClass } from "./primitives";
import { GridBackground } from "./gridBackground";
import { ReceiptSample } from "./receiptSample";

const FACTS = [
  { icon: IconGift, title: "خطة مجانية دائمة", text: "«بَسطة» لمحل بجهاز واحد" },
  { icon: IconWifiOff, title: "يعمل دون إنترنت", text: "البيانات على جهاز المحل" },
  {
    icon: IconDatabaseExport,
    title: "نسخ احتياطي يومي",
    text: "تلقائي ومشفّر",
  },
] as const;

export function HeroSection() {
  return (
    <section
      id="top"
      aria-labelledby="hero-title"
      className="relative isolate overflow-hidden"
    >
      <GridBackground />

      <Container className="grid items-center gap-14 pt-12 pb-20 sm:pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10 lg:pt-20 lg:pb-28">
        <div className="space-y-8">
          <p className="inline-flex items-center gap-2 border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground sm:text-sm">
            <span aria-hidden className="size-1.5 bg-success" />
            برنامج إدارة المحلات ونقاط البيع
            <span aria-hidden className="text-border">
              |
            </span>
            <span dir="ltr" className="font-mono text-foreground">
              v{DOWNLOADS.windows.version}
            </span>
          </p>

          <h1
            id="hero-title"
            className="max-w-[16ch] text-4xl leading-[1.3] font-bold tracking-tight text-balance sm:text-5xl sm:leading-[1.25] lg:text-[3.5rem]"
          >
            إدارة متجرك أصبحت أكثر سهولة ووضوحًا
          </h1>

          <p className="max-w-xl text-lg leading-8 text-pretty text-muted-foreground">
            من نقطة البيع والمشتريات إلى المخزون والخزنة وحسابات العملاء،
            اجمع إدارة أعمالك اليومية في برنامج واحد يعمل على جهاز محلك مع
            Dealzora.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <a href="#download" className={ctaClass("default", "lg")}>
              <IconDownload aria-hidden />
              تحميل البرنامج
            </a>
            <a href="#features" className={ctaClass("outline", "lg")}>
              استكشف المميزات
              <IconArrowDown aria-hidden />
            </a>
          </div>

          <ul className="grid grid-cols-1 border sm:grid-cols-3">
            {FACTS.map(({ icon: Icon, title, text }) => (
              <li
                key={title}
                className="flex items-center gap-3 border-b bg-background p-4 last:border-b-0 sm:border-b-0 sm:not-last:border-l"
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {text}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <ReceiptSample />
      </Container>
    </section>
  );
}
