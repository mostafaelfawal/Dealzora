import { IconBrandWindows, IconDownload, IconExternalLink } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { siAndroid, siApple, siLinux } from "simple-icons";

import { cn } from "@/lib/utils";

import {
  DOWNLOADS,
  isDownloadReady,
  RELEASES_URL,
  type DownloadConfig,
  type PlatformId,
} from "../config/site";
import { BrandIcon, Container, ctaClass, external, Section, SectionHeading } from "./primitives";

const PLATFORM: Record<PlatformId, { name: string; icon: ReactNode; action: string }> = {
  windows: {
    name: "ويندوز",
    icon: <IconBrandWindows className="size-6" aria-hidden />,
    action: "تحميل لويندوز",
  },
  linux: {
    name: "لينكس",
    icon: <BrandIcon icon={siLinux} className="size-6" />,
    action: "تحميل للينكس",
  },
  macos: {
    name: "ماك",
    icon: <BrandIcon icon={siApple} className="size-6" />,
    action: "تحميل لماك",
  },
  android: {
    name: "أندرويد",
    icon: <BrandIcon icon={siAndroid} className="size-6" />,
    action: "تحميل لأندرويد",
  },
  ios: {
    name: "آيفون",
    icon: <BrandIcon icon={siApple} className="size-6" />,
    action: "فتح نسخة الويب",
  },
};

function PlatformCard({
  id,
  config,
  primary,
  children,
}: {
  id: PlatformId;
  config: DownloadConfig;
  primary?: boolean;
  children?: ReactNode;
}) {
  const p = PLATFORM[id];
  const ready = isDownloadReady(config);

  return (
    <li className="flex flex-col gap-5 bg-background p-6">
      <div className="flex items-start justify-between gap-3">
        <span className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center border">{p.icon}</span>
          <span>
            <span className="block text-base font-semibold">{p.name}</span>
            <span className="block text-xs text-muted-foreground" dir="ltr">
              {config.fileType}
              {ready && config.version ? ` · v${config.version}` : ""}
            </span>
          </span>
        </span>
        <span
          className={cn(
            "border px-2 py-0.5 text-[11px]",
            ready ? "border-success/40 text-success" : "text-muted-foreground",
          )}
        >
          {ready ? "متاح الآن" : "غير متاح حالياً"}
        </span>
      </div>

      {children}

      <div className="mt-auto">
        {ready ? (
          <a
            href={config.url}
            {...(id === "ios" ? external : {})}
            className={cn(ctaClass(primary ? "default" : "outline", primary ? "lg" : "md"), "w-full")}
          >
            <IconDownload aria-hidden />
            {p.action}
          </a>
        ) : (
          <p className="border border-dashed p-3 text-center text-sm text-muted-foreground">
            سيُتاح {p.name === "آيفون" ? "رابط نسخة الويب" : "التحميل"} هنا فور صدوره
          </p>
        )}
      </div>
    </li>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="space-y-2 text-sm leading-6">
      {items.map((s, i) => (
        <li key={s} className="flex gap-3">
          <span
            className="flex size-6 shrink-0 items-center justify-center bg-muted font-mono text-xs"
            dir="ltr"
          >
            {i + 1}
          </span>
          {s}
        </li>
      ))}
    </ol>
  );
}

export function DownloadSection() {
  return (
    <Section id="download" aria-labelledby="download-title" className="bg-muted/40">
      <Container className="space-y-14">
        <SectionHeading
          id="download-title"
          index="06"
          eyebrow="التحميل"
          title="حمّل Dealzora على جهازك"
          lead="برنامج الكمبيوتر للإدارة الكاملة للمحل، وتطبيق الهاتف للمتابعة السريعة من أي مكان."
        />

        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-xl font-bold">برنامج الكمبيوتر</h3>
              <p className="text-sm text-muted-foreground">
                البيع والمخزون والمشتريات والحسابات والتقارير وكل الإعدادات.
              </p>
            </div>
            <a
              href={RELEASES_URL}
              {...external}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              كل الإصدارات وملاحظاتها
              <IconExternalLink className="size-4" aria-hidden />
            </a>
          </div>

          <ul className="grid gap-px border bg-border lg:grid-cols-[1.4fr_1fr_1fr]">
            <PlatformCard id="windows" config={DOWNLOADS.windows} primary>
              <Steps
                items={[
                  "حمّل ملف التثبيت وافتحه.",
                  "اتبع خطوات معالج التثبيت حتى النهاية.",
                  "عند أول تشغيل أدخل بيانات محلك وأنشئ حساب المالك.",
                ]}
              />
              <p className="text-xs leading-6 text-muted-foreground">
                يعمل على ويندوز 10 و11 بنظام <bdi dir="ltr">64-bit</bdi>. يصلك تنبيه داخل البرنامج عند
                صدور تحديث جديد.
              </p>
            </PlatformCard>
            <PlatformCard id="linux" config={DOWNLOADS.linux} />
            <PlatformCard id="macos" config={DOWNLOADS.macos} />
          </ul>
        </div>

        <div className="space-y-6">
          <div className="space-y-1">
            <h3 className="text-xl font-bold">تطبيق الهاتف</h3>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
              لأصحاب خطة «سلسلة» ومديري الفروع: متابعة الفروع والتقارير
              اللحظية، والموافقة على تحويلات المخزون، وتعديل الأسعار، والتنبيهات.
              التطبيق مكمّل لبرنامج الكمبيوتر ولا يحل محله.
            </p>
          </div>

          <ul className="grid gap-px border bg-border md:grid-cols-2">
            <PlatformCard id="android" config={DOWNLOADS.android} />
            <PlatformCard id="ios" config={DOWNLOADS.ios}>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  على آيفون يُثبَّت التطبيق كنسخة ويب (PWA) وليس من App Store:
                </p>
                <Steps
                  items={[
                    "افتح الرابط في متصفح Safari.",
                    "اضغط زر المشاركة.",
                    "اختر «إضافة إلى الشاشة الرئيسية».",
                  ]}
                />
              </div>
            </PlatformCard>
          </ul>
        </div>
      </Container>
    </Section>
  );
}
