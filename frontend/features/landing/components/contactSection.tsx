import { IconArrowUpLeft, IconPhone } from "@tabler/icons-react";
import { siWhatsapp } from "simple-icons";

import { cn } from "@/lib/utils";

import {
  CONTACT_PHONE,
  SOCIAL_LINKS,
  WHATSAPP_COMMUNITY_URL,
} from "../config/site";
import { BrandIcon, Container, ctaClass, external, Section, SectionHeading } from "./primitives";

/** اسم الحساب كما يظهر في الرابط (بدون اختلاق أسماء). */
function handleOf(url: string): string {
  const u = new URL(url);
  if (u.hostname === "chat.whatsapp.com") return "مجموعة المجتمع";
  if (u.searchParams.get("id")) return "Dealzora";
  return u.pathname.replace(/^\//, "") || u.hostname;
}

export function ContactSection() {
  const socials = SOCIAL_LINKS.slice(1);

  return (
    <Section id="contact" aria-labelledby="contact-title">
      <Container className="space-y-12">
        <SectionHeading
          id="contact-title"
          index="09"
          eyebrow="تواصل معنا"
          title="ابقَ على تواصل مع Dealzora"
          lead="تابع الجديد في البرنامج، واطرح أسئلتك، وشارك تجربتك مع تجار آخرين."
        />

        <div className="grid gap-px border bg-border lg:grid-cols-[1fr_1.2fr]">
          <div className="flex flex-col justify-between gap-8 bg-primary p-8 text-primary-foreground sm:p-10">
            <div className="space-y-3">
              <BrandIcon icon={siWhatsapp} className="size-8" />
              <h3 className="text-2xl leading-snug font-bold">
                انضم إلى مجتمع Dealzora على واتساب
              </h3>
              <p className="leading-8 opacity-80">
                مكان واحد للإعلان عن التحديثات والشروحات الجديدة، وللإجابة عن
                أسئلة الاستخدام اليومية.
              </p>
            </div>
            <a
              href={WHATSAPP_COMMUNITY_URL}
              {...external}
              className={cn(
                ctaClass("secondary", "lg"),
                "self-start bg-primary-foreground text-primary hover:bg-primary-foreground/90",
              )}
            >
              <BrandIcon icon={siWhatsapp} className="size-5" />
              انضم إلى المجموعة
            </a>
          </div>

          <ul className="grid gap-px bg-border sm:grid-cols-2">
            <li className="bg-background">
              <a
                href={`tel:${CONTACT_PHONE}`}
                aria-label={`اتصل بنا على الرقم ${CONTACT_PHONE}`}
                className="group flex h-full min-h-24 items-center gap-4 p-6 outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <span className="flex size-11 shrink-0 items-center justify-center border bg-background">
                  <IconPhone className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">اتصل بنا</span>
                  <span
                    className="block truncate text-sm text-muted-foreground"
                    dir="ltr"
                  >
                    {CONTACT_PHONE}
                  </span>
                </span>
                <IconArrowUpLeft
                  className="size-5 text-muted-foreground transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5"
                  aria-hidden
                />
              </a>
            </li>
            {socials.map((s) => (
              <li key={s.name} className="bg-background">
                <a
                  href={s.url}
                  {...external}
                  aria-label={`${s.label} (يفتح في نافذة جديدة)`}
                  className="group flex h-full min-h-24 items-center gap-4 p-6 outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center border bg-background">
                    <BrandIcon icon={s.icon} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold" dir="ltr">
                      {s.name}
                    </span>
                    <span
                      className="block truncate text-sm text-muted-foreground"
                      dir="ltr"
                    >
                      {handleOf(s.url)}
                    </span>
                  </span>
                  <IconArrowUpLeft
                    className="size-5 text-muted-foreground transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5"
                    aria-hidden
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </Section>
  );
}
