import { IconPlus } from "@tabler/icons-react";

import { FAQ, REASONS } from "../config/content";
import { Container, Section, SectionHeading } from "./primitives";
import { Stagger, StaggerItem } from "./motion";

/** لماذا Dealzora: أربع نقاط موثّقة من البرنامج نفسه، بلا ادعاءات أرقام أو عملاء. */
export function WhySection() {
  return (
    <Section aria-labelledby="why-title">
      <Container className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <SectionHeading
          id="why-title"
          index="07"
          eyebrow="لماذا Dealzora؟"
          title="مبني لواقع المحل العربي، لا لعرض تقديمي"
          lead="كل ما في هذه القائمة موجود في البرنامج اليوم، ويمكنك تجربته بنفسك على الخطة المجانية."
          className="lg:sticky lg:top-24 lg:self-start"
        />
        <Stagger as="ul" stagger={0.12} className="divide-y border-y">
          {REASONS.map(({ icon: Icon, title, description }) => (
            <StaggerItem
              as="li"
              variant="start"
              key={title}
              className="flex gap-5 py-7"
            >
              <span className="flex size-11 shrink-0 items-center justify-center border">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="space-y-1.5">
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-[15px] leading-7 text-muted-foreground">
                  {description}
                </p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </Section>
  );
}

/** الأسئلة الشائعة بعنصر details الأصلي: يعمل بلوحة المفاتيح وقارئ الشاشة دون JavaScript. */
export function FaqSection() {
  return (
    <Section id="faq" aria-labelledby="faq-title" className="bg-muted/40">
      <Container className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <SectionHeading
          id="faq-title"
          index="08"
          eyebrow="الأسئلة الشائعة"
          title="إجابات واضحة قبل أن تبدأ"
          lead="لم تجد سؤالك؟ اسألنا مباشرة في مجتمع Dealzora على واتساب."
          className="lg:sticky lg:top-24 lg:self-start"
        />
        <Stagger stagger={0.07} amount={0.1} className="border bg-background">
          {FAQ.map((item) => (
            <StaggerItem
              as="details"
              key={item.question}
              className="landing-faq group border-b last:border-b-0"
            >
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-base font-semibold outline-none hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-6">
                {item.question}
                <IconPlus
                  className="landing-faq-icon size-5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </summary>
              <p className="landing-faq-body px-5 pb-6 text-[15px] leading-8 text-muted-foreground sm:px-6">
                {item.answer}
              </p>
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </Section>
  );
}
