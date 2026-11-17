"use client";

import { IconPlayerPlayFilled } from "@tabler/icons-react";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import {
  CATEGORY_BY_ID,
  isPlaceholderVideo,
  lessonsLabel,
  TUTORIAL_CATEGORIES,
  tutorialsIn,
  type ResolvedTutorial,
} from "../config/tutorials";
import { youtubeEmbedUrl, youtubeThumbnail } from "../lib/youtube";

/** غلاف بهوية Dealzora للشروحات التي لم يُضف رابطها الحقيقي بعد (العنوان تحته في البطاقة). */
function BrandedCover({ tutorial }: { tutorial: ResolvedTutorial }) {
  const category = CATEGORY_BY_ID.get(tutorial.category);
  const Icon = category?.icon;
  return (
    <span className="absolute inset-0 bg-muted">
      <span aria-hidden className="landing-grid absolute inset-0 opacity-60" />
      <span className="absolute inset-x-4 top-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="truncate">{category?.title}</span>
        {Icon && <Icon className="size-5 shrink-0 text-foreground" aria-hidden />}
      </span>
      <span className="absolute right-4 bottom-3 text-xs text-muted-foreground">
        الدرس{" "}
        <span className="font-mono text-sm font-semibold text-foreground" dir="ltr">
          {String(tutorial.lesson).padStart(2, "0")}
        </span>
      </span>
    </span>
  );
}

export function TutorialCard({
  tutorial,
  onPlay,
  showCategory = true,
}: {
  tutorial: ResolvedTutorial;
  onPlay: () => void;
  showCategory?: boolean;
}) {
  const placeholder = !tutorial.thumbnail && isPlaceholderVideo(tutorial.videoId);

  return (
    <li className="group flex flex-col border bg-background">
      <button
        type="button"
        onClick={onPlay}
        aria-label={`تشغيل الشرح: ${tutorial.title}`}
        className="relative block aspect-video w-full overflow-hidden bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {placeholder ? (
          <BrandedCover tutorial={tutorial} />
        ) : (
          // صورة يوتيوب خارجية بحجم ثابت: img عادي بتحميل كسول يكفي.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tutorial.thumbnail ?? youtubeThumbnail(tutorial.videoId)}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        )}
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-colors",
            !placeholder && "bg-black/15 group-hover:bg-black/25",
          )}
        >
          <span className="flex size-14 items-center justify-center bg-primary text-primary-foreground shadow-lg transition-transform group-hover:scale-105">
            <IconPlayerPlayFilled className="size-6" aria-hidden />
          </span>
        </span>
        {tutorial.duration && (
          <span
            className="absolute bottom-2 left-2 bg-black/75 px-1.5 py-0.5 font-mono text-xs text-white"
            dir="ltr"
          >
            {tutorial.duration}
          </span>
        )}
      </button>
      <div className="flex flex-1 flex-col gap-2 p-5">
        {/* رقم الدرس ظاهر على الغلاف المؤقت؛ نكرره هنا فقط فوق صور يوتيوب أو مع اسم القسم. */}
        {(showCategory || !placeholder) && (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono" dir="ltr">
              {String(tutorial.lesson).padStart(2, "0")}
            </span>
            {showCategory && (
              <>
                <span aria-hidden className="h-px w-3 bg-border" />
                {CATEGORY_BY_ID.get(tutorial.category)?.title}
              </>
            )}
          </span>
        )}
        <h3 className="text-base leading-7 font-semibold">{tutorial.title}</h3>
        <p className="text-sm leading-7 text-muted-foreground">{tutorial.description}</p>
      </div>
    </li>
  );
}

/** نافذة المشغّل: الـ iframe يُحمَّل عند الفتح فقط ويُزال عند الإغلاق (يتوقف الفيديو). */
export function TutorialDialog({
  tutorial,
  onClose,
}: {
  tutorial: ResolvedTutorial | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={tutorial !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(94vw,64rem)] max-w-none gap-0 p-0 sm:max-w-none">
        {tutorial && (
          <>
            <div className="space-y-1 p-4 pe-12">
              <DialogTitle className="text-base font-semibold">{tutorial.title}</DialogTitle>
              <DialogDescription className="text-sm">{tutorial.description}</DialogDescription>
            </div>
            <div className="relative aspect-video w-full bg-black">
              <iframe
                src={youtubeEmbedUrl(tutorial.videoId)}
                title={tutorial.title}
                className="absolute inset-0 size-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** شبكة بطاقات مع مشغّلها (الصفحة الرئيسية). */
export function TutorialGrid({ tutorials }: { tutorials: ResolvedTutorial[] }) {
  const [playing, setPlaying] = useState<ResolvedTutorial | null>(null);
  return (
    <>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {tutorials.map((t) => (
          <TutorialCard key={t.id} tutorial={t} onPlay={() => setPlaying(t)} />
        ))}
      </ul>
      <TutorialDialog tutorial={playing} onClose={() => setPlaying(null)} />
    </>
  );
}

/** مكتبة الشروحات كاملة مقسّمة حسب القسم (صفحة /tutorials)، بمشغّل واحد. */
export function TutorialLibrary() {
  const [playing, setPlaying] = useState<ResolvedTutorial | null>(null);

  return (
    <>
      <div className="space-y-20">
        {TUTORIAL_CATEGORIES.map((category, i) => {
          const items = tutorialsIn(category.id);
          if (items.length === 0) return null;
          const Icon = category.icon;
          return (
            <section
              key={category.id}
              id={category.id}
              aria-labelledby={`cat-${category.id}`}
              className="scroll-mt-12 space-y-8"
            >
              <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-start gap-4">
                  <span className="flex size-12 shrink-0 items-center justify-center border bg-background">
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <div className="space-y-1">
                    <p className="font-mono text-xs text-muted-foreground" dir="ltr">
                      {String(i + 1).padStart(2, "0")} / {TUTORIAL_CATEGORIES.length}
                    </p>
                    <h2 id={`cat-${category.id}`} className="text-2xl font-bold">
                      {category.title}
                    </h2>
                    <p className="text-sm leading-7 text-muted-foreground">
                      {category.description}
                    </p>
                  </div>
                </div>
                <p className="shrink-0 text-sm text-muted-foreground">
                  {lessonsLabel(items.length)}
                </p>
              </header>
              <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((t) => (
                  <TutorialCard
                    key={t.id}
                    tutorial={t}
                    showCategory={false}
                    onPlay={() => setPlaying(t)}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <TutorialDialog tutorial={playing} onClose={() => setPlaying(null)} />
    </>
  );
}
