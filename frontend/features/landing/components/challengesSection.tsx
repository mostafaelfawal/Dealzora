import { IconArrowLeft } from "@tabler/icons-react";

import { CHALLENGES } from "../config/content";
import { Container, Section, SectionHeading } from "./primitives";
import { Stagger, StaggerItem } from "./motion";

/** جدول «المشكلة ← الحل»: صف لكل تحدٍّ يومي يقابله ما يفعله البرنامج فعلاً. */
export function ChallengesSection() {
  return (
    <Section aria-labelledby="challenges-title" className="bg-muted/40">
      <Container className="space-y-12">
        <SectionHeading
          id="challenges-title"
          index="01"
          eyebrow="لماذا يحتاج متجرك إلى نظام؟"
          title="تحديات يومية يعرفها كل تاجر، وحلول عملية لها"
          lead="الأرقام المتفرقة بين الدفاتر والذاكرة تكلّفك وقتاً ومالاً. هكذا يرتّبها Dealzora."
        />

        <Stagger as="ol" amount={0.15} className="border bg-background">
          <StaggerItem
            as="li"
            variant="fade"
            aria-hidden
            className="hidden grid-cols-[3rem_1fr_2.5rem_1.2fr] items-center gap-6 border-b px-6 py-3 text-xs font-medium text-muted-foreground md:grid"
          >
            <span />
            <span>التحدي</span>
            <span />
            <span>كيف يعالجه Dealzora</span>
          </StaggerItem>
          {CHALLENGES.map((c, i) => (
            <StaggerItem
              as="li"
              variant="start"
              key={c.problem}
              className="grid gap-4 border-b p-5 last:border-b-0 sm:p-6 md:grid-cols-[3rem_1fr_2.5rem_1.2fr] md:items-center md:gap-6"
            >
              <span
                className="font-mono text-sm text-muted-foreground"
                dir="ltr"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">{c.problem}</h3>
                <p className="text-sm leading-7 text-muted-foreground">
                  {c.detail}
                </p>
              </div>
              <IconArrowLeft
                aria-hidden
                className="hidden size-5 text-muted-foreground md:block"
              />
              <p className="border-s-2 border-foreground ps-4 text-[15px] leading-7 md:border-s-0 md:ps-0">
                <span className="sr-only">الحل: </span>
                {c.solution}
              </p>
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </Section>
  );
}
