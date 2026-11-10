"use client";

import { IconFileSpreadsheet, IconUpload } from "@tabler/icons-react";

import { MotionDiv, tSpring } from "@/components/shared/motion";

const FORMATS = ["xlsx", "xls", "csv"];

/**
 * طبقة "أفلت هنا" فوق النافذة كلها أثناء سحب ملف.
 * pointer-events-none: لا تعترض أحداث السحب، فيبقى useFileDrop هو من يستقبل الإفلات.
 */
export function ProductsDropOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <MotionDiv
      role="status"
      aria-live="assertive"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.15 } }}
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-6 backdrop-blur-sm"
    >
      <MotionDiv
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1, transition: tSpring }}
        className="relative flex w-full max-w-xl flex-col items-center gap-5 border-2 border-dashed border-primary bg-card/95 px-8 py-14 text-center shadow-2xl"
      >
        {/* إطار متوهج خلف البطاقة */}
        <span
          aria-hidden
          className="absolute -inset-px -z-10 animate-pulse bg-primary/10 blur-xl"
        />

        <span className="relative flex size-20 items-center justify-center bg-primary/10 text-primary">
          <IconFileSpreadsheet className="size-11" stroke={1.4} />
          <span className="absolute -bottom-2 -end-2 flex size-8 animate-bounce items-center justify-center bg-primary text-primary-foreground shadow-lg">
            <IconUpload className="size-4" />
          </span>
        </span>

        <div className="space-y-1.5">
          <p className="text-xl font-bold">أفلت ملف Excel هنا</p>
          <p className="text-sm text-muted-foreground">
            سنقرأ الأعمدة ونربطها بحقول الأصناف تلقائياً، وتراجعها قبل
            الاستيراد.
          </p>
        </div>

        <ul className="flex items-center gap-1.5">
          {FORMATS.map((ext) => (
            <li
              key={ext}
              dir="ltr"
              className="border bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
            >
              .{ext}
            </li>
          ))}
        </ul>
      </MotionDiv>
    </MotionDiv>
  );
}
