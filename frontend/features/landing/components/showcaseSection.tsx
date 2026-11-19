"use client";

import {
  IconArrowsMaximize,
  IconMinus,
  IconSquare,
  IconX,
} from "@tabler/icons-react";
import { m } from "framer-motion";
import Image from "next/image";
import { useState, type KeyboardEvent } from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { SCREENSHOTS, type Screenshot } from "../config/site";
import { Reveal } from "./motion";
import { Container, Section, SectionHeading } from "./primitives";

/** إطار نافذة ويندوز (البرنامج يعمل على ويندوز) حول اللقطة. */
function WindowFrame({
  shot,
  onExpand,
}: {
  shot: Screenshot;
  onExpand?: () => void;
}) {
  return (
    <div className="overflow-hidden border bg-card shadow-[0_24px_48px_-24px_oklch(0_0_0/0.25)] dark:shadow-[0_24px_48px_-24px_oklch(0_0_0/0.7)]">
      <div className="flex h-9 items-center justify-between border-b bg-muted/60 ps-3 text-xs text-muted-foreground">
        <span className="truncate">
          <span dir="ltr">Dealzora</span> — {shot.title}
        </span>
        {/* أزرار النافذة شكلية فقط (aria-hidden)، والتكبير زر حقيقي منفصل. */}
        <span aria-hidden className="flex h-full" dir="ltr">
          <span className="flex w-10 items-center justify-center">
            <IconMinus className="size-3.5" />
          </span>
          <span className="flex w-10 items-center justify-center">
            <IconSquare className="size-3" />
          </span>
          <span className="flex w-10 items-center justify-center">
            <IconX className="size-3.5" />
          </span>
        </span>
      </div>

      <div
        className="relative bg-muted/30"
        style={{ aspectRatio: `${shot.width} / ${shot.height}` }}
      >
        <Image
          src={shot.src ?? "/logo.png"}
          alt={`لقطة شاشة ${shot.title} في Dealzora`}
          fill
          sizes="(min-width: 1024px) 64rem, 100vw"
          className="object-contain"
        />
        {onExpand && (
          <button
            type="button"
            onClick={onExpand}
            className="absolute bottom-3 left-3 inline-flex h-9 items-center gap-1.5 border bg-background/90 px-3 text-xs font-medium outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring"
          >
            <IconArrowsMaximize className="size-4" aria-hidden />
            تكبير
          </button>
        )}
      </div>
    </div>
  );
}

export function ShowcaseSection() {
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const shot = SCREENSHOTS[active];

  // تنقل الأسهم بين التبويبات (نمط tablist القياسي، مع اتجاه RTL).
  function onTabKey(e: KeyboardEvent<HTMLButtonElement>) {
    const last = SCREENSHOTS.length - 1;
    let next: number | null = null;
    if (e.key === "ArrowLeft") next = active === last ? 0 : active + 1;
    else if (e.key === "ArrowRight") next = active === 0 ? last : active - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    document.getElementById(`shot-tab-${SCREENSHOTS[next].id}`)?.focus();
  }

  return (
    <Section
      id="showcase"
      aria-labelledby="showcase-title"
      className="bg-muted/40"
    >
      <Container className="space-y-10">
        <SectionHeading
          id="showcase-title"
          index="03"
          eyebrow="من داخل البرنامج"
          title="واجهة واحدة واضحة لكل عمليات المحل"
          lead="شاشات مصمَّمة للعمل السريع خلف الكاشير: خطوط واضحة، وأرقام كبيرة، ووضع فاتح وداكن."
        />

        <Reveal
          role="tablist"
          aria-label="شاشات البرنامج"
          className="flex gap-px overflow-x-auto border bg-border scrollbar-none"
        >
          {SCREENSHOTS.map((s, i) => (
            <button
              key={s.id}
              id={`shot-tab-${s.id}`}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-controls="shot-panel"
              tabIndex={i === active ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={onTabKey}
              className={cn(
                "h-12 min-w-28 flex-1 px-4 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                i === active
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {s.title}
            </button>
          ))}
        </Reveal>

        {/* النافذة تصعد وتتكبّر عند الوصول إليها، والتبديل بين اللقطات بتلاشٍ قصير. */}
        <Reveal
          as="figure"
          variant="zoom"
          amount={0.25}
          id="shot-panel"
          role="tabpanel"
          aria-labelledby={`shot-tab-${shot.id}`}
          className="space-y-4"
        >
          <m.div
            key={shot.id}
            initial={{ opacity: 0.4, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <WindowFrame
              shot={shot}
              onExpand={shot.src ? () => setZoomed(true) : undefined}
            />
          </m.div>
          <figcaption className="text-center text-sm text-muted-foreground">
            {shot.caption}
          </figcaption>
        </Reveal>
      </Container>

      {shot.src && (
        <Dialog open={zoomed} onOpenChange={setZoomed}>
          <DialogContent className="w-[min(96vw,80rem)] max-w-none p-2 sm:max-w-none">
            <DialogTitle className="sr-only">{shot.title}</DialogTitle>
            <div
              className="relative w-full"
              style={{ aspectRatio: `${shot.width} / ${shot.height}` }}
            >
              <Image
                src={shot.src}
                alt={`لقطة شاشة ${shot.title} في Dealzora`}
                fill
                sizes="96vw"
                className="object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Section>
  );
}
