import { IconArrowLeft, IconBrandYoutube } from "@tabler/icons-react";
import Link from "next/link";

import { YOUTUBE_CHANNEL_URL } from "../config/site";
import {
  FEATURED_TUTORIALS,
  lessonsLabel,
  PUBLISHED_TUTORIALS,
  PUBLISHED_VIDEO_IDS,
  RESOLVED_TUTORIALS,
  TUTORIAL_CATEGORIES,
  tutorialsIn,
} from "../config/tutorials";
import { getYoutubeDurations } from "../lib/youtubeDurations";
import {
  Container,
  ctaClass,
  external,
  Section,
  SectionHeading,
} from "./primitives";
import { Reveal } from "./motion";
import { TutorialGrid } from "./tutorialPlayer";

/** مختارات من الشروحات في الرئيسية، والمكتبة الكاملة في /tutorials. */
export async function TutorialsSection() {
  const total = RESOLVED_TUTORIALS.length;
  if (total === 0) return null;
  const published = PUBLISHED_TUTORIALS.length;
  const featured =
    FEATURED_TUTORIALS.length > 0
      ? FEATURED_TUTORIALS
      : RESOLVED_TUTORIALS.slice(0, 6);
  const durations = await getYoutubeDurations(PUBLISHED_VIDEO_IDS);

  return (
    <Section id="tutorials" aria-labelledby="tutorials-title">
      <Container className="space-y-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHeading
            id="tutorials-title"
            index="04"
            eyebrow="الشروحات"
            title="تعلّم استخدام Dealzora"
            lead={
              published > 0
                ? `مكتبة من ${lessonsLabel(published)} بالفيديو تأخذك خطوة بخطوة من أول تشغيل إلى التقارير.`
                : "شروحات بالفيديو تأخذك خطوة بخطوة من أول تشغيل إلى التقارير."
            }
          />
          <Reveal variant="end" delay={0.3} className="self-start md:self-auto">
            <a
              href={YOUTUBE_CHANNEL_URL}
              {...external}
              className={ctaClass("outline")}
            >
              <IconBrandYoutube aria-hidden />
              قناة Dealzora على يوتيوب
            </a>
          </Reveal>
        </div>

        <TutorialGrid tutorials={featured} durations={durations} />

        {/* أقسام المكتبة: كل قسم يفتح مكانه في صفحة الشروحات. */}
        <Reveal className="grid gap-px border bg-border sm:grid-cols-2 lg:grid-cols-[repeat(3,1fr)_auto]">
          {TUTORIAL_CATEGORIES.slice(0, 3).map((c) => (
            <CategoryLink
              key={c.id}
              id={c.id}
              title={c.title}
              count={tutorialsIn(c.id).length}
            />
          ))}
          <Link
            href="/tutorials"
            className="flex items-center justify-center gap-2 bg-primary px-6 py-5 text-sm font-semibold text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 order-last sm:col-span-2 lg:order-0 lg:col-span-1 lg:row-span-2"
          >
            كل الشروحات
            <span className="font-mono" dir="ltr">
              ({total})
            </span>
            <IconArrowLeft className="size-4" aria-hidden />
          </Link>
          {/* الرئيسية تعرض أول ستة أقسام فقط، والبقية في صفحة الشروحات. */}
          {TUTORIAL_CATEGORIES.slice(3, 6).map((c) => (
            <CategoryLink
              key={c.id}
              id={c.id}
              title={c.title}
              count={tutorialsIn(c.id).length}
            />
          ))}
        </Reveal>
      </Container>
    </Section>
  );
}

function CategoryLink({
  id,
  title,
  count,
}: {
  id: string;
  title: string;
  count: number;
}) {
  return (
    <Link
      href={`/tutorials#${id}`}
      className="group flex items-center justify-between gap-3 bg-background px-5 py-4 text-sm outline-none hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
    >
      <span className="font-medium">{title}</span>
      <span className="text-xs text-muted-foreground">
        {lessonsLabel(count)}
      </span>
    </Link>
  );
}
