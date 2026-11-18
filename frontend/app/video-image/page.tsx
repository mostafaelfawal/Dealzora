import { IconDownload, IconRocket } from "@tabler/icons-react";

import { BrandLogo } from "@/components/shared/BrandLogo";
import { BRAND } from "@/config/brand";

import "../../features/landing/landing.css";

/* بيانات الصورة المصغّرة — عدّلها لكل درس. */
const ICON = IconDownload;
const TITLE = "تحميل البرنامج وتثبيته";
const NUMBER = "1";

const CATEGORY = {
  icon: IconRocket,
  name: `ابدأ مع ${BRAND.name}`,
  text: "text-green-500",
  bg: "bg-green-500",
};

export default function VideoImage() {
  const CategoryIcon = CATEGORY.icon;

  return (
    <div className="relative isolate flex h-screen items-center justify-center gap-6 overflow-hidden">
      <div className="landing-grid pointer-events-none absolute inset-0 -z-10" />

      {/* الشعار */}
      <div className="absolute top-0 right-0 flex items-center gap-4 p-10">
        <BrandLogo variant="icon" className="h-14 rounded-none" />
        <span className="text-4xl font-extrabold tracking-tight">
          {BRAND.name}
        </span>
      </div>

      <div className="flex flex-col items-end">
        {/* رقم الدرس */}
        <div className="flex w-fit items-center gap-6 border border-border bg-popover px-5 py-3 text-4xl font-semibold">
          الدرس
          <span className="font-mono">{NUMBER.padStart(2, "0")}</span>
        </div>

        {/* التصنيف */}
        <div className="mt-5 mb-2 flex items-center gap-2">
          <CategoryIcon size={24} stroke={1.8} className={CATEGORY.text} />
          <span className={`text-xl font-semibold ${CATEGORY.text}`}>
            {CATEGORY.name}
          </span>
          <span className={`ml-1 h-6 w-1 ${CATEGORY.bg}`} />
        </div>

        {/* عنوان الدرس */}
        <h1 className="max-w-207 text-right text-9xl font-extrabold">
          {TITLE}
        </h1>

        <div className={`mt-6 h-1.25 w-[70%] self-center ${CATEGORY.bg}`} />
      </div>

      {/* أيقونة الدرس */}
      <div className="relative flex h-110 w-123 items-center justify-center border-2 border-white/90 bg-popover">
        <div className="absolute -z-1 h-110 w-125 rotate-175 border-2 border-white/60 shadow-2xl shadow-white/10" />
        <ICON size={350} />
      </div>

      {/* التذييل */}
      <span className="absolute bottom-0 left-0 p-10 text-3xl font-bold text-muted-foreground">
        شروحات {BRAND.name}
      </span>
    </div>
  );
}
