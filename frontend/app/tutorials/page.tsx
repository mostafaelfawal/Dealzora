import type { Metadata } from "next";
import Link from "next/link";
import { IconBrandYoutube, IconChevronLeft } from "@tabler/icons-react";
import { siWhatsapp } from "simple-icons";

import "@/features/landing/landing.css";

import { LandingFooter } from "@/features/landing/components/landingFooter";
import { LandingHeader } from "@/features/landing/components/landingHeader";
import { GridBackground } from "@/features/landing/components/gridBackground";
import {
  BrandIcon,
  Container,
  ctaClass,
  external,
} from "@/features/landing/components/primitives";
import { TutorialLibrary } from "@/features/landing/components/tutorialPlayer";
import {
  WHATSAPP_COMMUNITY_URL,
  YOUTUBE_CHANNEL_URL,
} from "@/features/landing/config/site";
import {
  lessonsLabel,
  PUBLISHED_TUTORIALS,
  PUBLISHED_VIDEO_IDS,
  TUTORIAL_CATEGORIES,
  tutorialsIn,
} from "@/features/landing/config/tutorials";
import { getYoutubeDurations } from "@/features/landing/lib/youtubeDurations";

const TITLE = "شروحات Dealzora | تعلّم برنامج الكاشير وإدارة المحل بالفيديو";
const DESCRIPTION =
  "شروحات فيديو مرتبة لبرنامج Dealzora: التثبيت والإعداد، والمنتجات والمخزون، ونقطة البيع، والمشتريات، والعملاء والموردين، والخزنة والتقارير.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/tutorials" },
  openGraph: {
    type: "website",
    url: "/tutorials",
    locale: "ar_EG",
    siteName: "Dealzora",
    title: TITLE,
    description: DESCRIPTION,
    images: [
      { url: "/logo/logo.png", width: 512, height: 512, alt: "Dealzora" },
    ],
  },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

export default async function TutorialsPage() {
  const categories = TUTORIAL_CATEGORIES.filter(
    (c) => tutorialsIn(c.id).length > 0,
  );
  const published = PUBLISHED_TUTORIALS.length;
  const durations = await getYoutubeDurations(PUBLISHED_VIDEO_IDS);

  return (
    <div className="landing-root flex min-h-full flex-col">
      <LandingHeader />
      <main id="main" className="flex-1">
        <section
          aria-labelledby="tutorials-page-title"
          className="relative isolate overflow-hidden border-b"
        >
          <GridBackground />
          <Container className="space-y-8 py-14 sm:py-20">
            <nav aria-label="مسار الصفحة">
              <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <li>
                  <Link
                    href="/"
                    className="outline-none hover:text-foreground focus-visible:underline"
                  >
                    الرئيسية
                  </Link>
                </li>
                <li aria-hidden>
                  <IconChevronLeft className="size-4" />
                </li>
                <li aria-current="page" className="text-foreground">
                  الشروحات
                </li>
              </ol>
            </nav>

            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="max-w-2xl space-y-4">
                <h1
                  id="tutorials-page-title"
                  className="text-4xl leading-[1.3] font-bold tracking-tight sm:text-5xl"
                >
                  تعلّم استخدام Dealzora
                </h1>
                <p className="text-lg leading-8 text-pretty text-muted-foreground">
                  {published > 0
                    ? `مكتبة من ${lessonsLabel(published)} بالفيديو، مرتبة حسب أقسام البرنامج.`
                    : "مكتبة شروحات بالفيديو مرتبة حسب أقسام البرنامج."}{" "}
                  ابدأ من القسم الأول إن كنت جديداً، أو انتقل مباشرة إلى ما
                  تحتاجه.
                </p>
              </div>
              <a
                href={YOUTUBE_CHANNEL_URL}
                {...external}
                className={ctaClass("outline", "lg")}
              >
                <IconBrandYoutube aria-hidden />
                اشترك في القناة
              </a>
            </div>
          </Container>
        </section>

        {/* تنقل سريع بين الأقسام، يلتصق أسفل الرأس عند التمرير. */}
        <nav
          aria-label="أقسام الشروحات"
          className="sticky top-16 z-30 border-b bg-background/90 backdrop-blur-sm supports-backdrop-filter:bg-background/75"
        >
          <Container>
            <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 py-2 scrollbar-none sm:mx-0 sm:px-0">
              {categories.map((c) => (
                <li key={c.id} className="shrink-0">
                  <a
                    href={`#${c.id}`}
                    className="inline-flex h-10 items-center gap-2 border border-transparent px-3 text-sm text-muted-foreground outline-none transition-colors hover:border-border hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {c.title}
                    <span className="font-mono text-xs" dir="ltr">
                      {tutorialsIn(c.id).length}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </Container>
        </nav>

        <Container className="py-16 sm:py-20">
          <TutorialLibrary durations={durations} />
        </Container>

        <section
          aria-labelledby="tutorials-help"
          className="border-t bg-muted/40"
        >
          <Container className="flex flex-col gap-6 py-14 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <h2 id="tutorials-help" className="text-2xl font-bold">
                لم تجد الشرح الذي تبحث عنه؟
              </h2>
              <p className="leading-7 text-muted-foreground">
                اطرح سؤالك في مجتمع Dealzora على واتساب، وسنضيف الشروحات الأكثر
                طلباً.
              </p>
            </div>
            <a
              href={WHATSAPP_COMMUNITY_URL}
              {...external}
              className={ctaClass("default", "lg")}
            >
              <BrandIcon icon={siWhatsapp} />
              انضم إلى المجتمع
            </a>
          </Container>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
