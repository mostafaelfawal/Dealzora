"use client";

import { useRef, useState } from "react";

import { IconDownload, IconRocket } from "@tabler/icons-react";

import { toPng } from "html-to-image";

import { BrandLogo } from "@/components/shared/BrandLogo";
import { BRAND } from "@/config/brand";

import "../../features/landing/landing.css";

/* ==========================================
   VIDEO CONFIGURATION
   غيّر هذه البيانات لكل فيديو جديد
========================================== */

const VIDEO = {
  title: "تحميل البرنامج وتثبيته",
  number: 1,
  icon: IconDownload,

  category: {
    name: `ابدأ مع ${BRAND.name}`,
    icon: IconRocket,
    color: "text-green-500",
    bg: "bg-green-500",
  },
};

/* ==========================================
   THUMBNAIL GENERATOR
========================================== */

export default function VideoImage() {
  const thumbnailRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const VideoIcon = VIDEO.icon;
  const CategoryIcon = VIDEO.category.icon;

  /* ==========================================
     DOWNLOAD THUMBNAIL
  ========================================== */

  const handleDownload = async () => {
    if (!thumbnailRef.current || isExporting) return;

    setIsExporting(true);

    try {
      const dataUrl = await toPng(thumbnailRef.current, {
        width: 1280,
        height: 720,
        pixelRatio: 1,
        backgroundColor: "#090909",
        cacheBust: true,
      });

      const link = document.createElement("a");

      const safeTitle = VIDEO.title
        .replace(/[<>:"/\\|?*]/g, "")
        .replace(/\s+/g, "-");

      link.download = `Dealzora-Lesson-${String(VIDEO.number).padStart(
        2,
        "0",
      )}-${safeTitle}.png`;

      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Thumbnail export failed:", error);
      alert("حدث خطأ أثناء إنشاء الصورة. حاول مرة أخرى.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#090909] px-5 py-8">
      {/* ==================================
          EXPORT TOOLBAR
      ================================== */}

      <div className="mx-auto mb-6 flex max-w-7xl items-center justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-white">Thumbnail Generator</h2>

          <span className="text-sm text-white/50">
            Dealzora Tutorial Series · 1280 × 720
          </span>
        </div>

        <button
          type="button"
          onClick={handleDownload}
          disabled={isExporting}
          className="
            flex items-center gap-2
            bg-green-600 px-6 py-3
            font-bold text-white
            transition-colors
            hover:bg-green-500
            disabled:cursor-wait disabled:opacity-60
          "
        >
          <IconDownload size={20} stroke={2} />

          {isExporting ? "جاري تجهيز الصورة..." : "تحميل الصورة"}
        </button>
      </div>

      {/* ==================================
          THUMBNAIL CANVAS
          هذا الجزء فقط يتم تصديره
      ================================== */}

      <div className="mx-auto w-full max-w-7xl overflow-x-auto">
        <div
          ref={thumbnailRef}
          dir="rtl"
          className="
            relative isolate
            flex h-180 w-7xl
            items-center justify-center
            overflow-hidden
            bg-[#090909] text-white
            select-none
          "
        >
          {/* Background Grid */}

          <div
            className="
            landing-grid pointer-events-none
            absolute inset-0 -z-10 opacity-40
          "
          />

          {/* ==================================
              BRAND HEADER
          ================================== */}

          <div
            className="
            absolute right-12 top-9
            flex items-center gap-4
          "
          >
            <BrandLogo variant="icon" className="h-14 rounded-none" />

            <span className="text-4xl font-extrabold tracking-tight">
              {BRAND.name}
            </span>
          </div>

          {/* ==================================
              MAIN CONTENT
          ================================== */}

          <div
            className="
            flex w-full items-center gap-8
            px-10 pt-16
          "
          >
            {/* VIDEO ICON */}

            <div
              className="
              relative flex h-105 w-105
              shrink-0 items-center justify-center
            "
            >
              {/* Decorative Frames */}

              <div
                className="
                absolute inset-0 rotate-[-5deg]
                border border-white/40
              "
              />

              <div
                className="
                absolute inset-2 rotate-3
                border border-white/20
              "
              />

              {/* Main Icon */}

              <div
                className="
                relative flex h-97.5 w-97.5
                items-center justify-center
                border-2 border-white/90
                bg-[#171717]
                shadow-[0_20px_80px_rgba(255,255,255,0.05)]
              "
              >
                <VideoIcon size={240} stroke={1.35} className="text-white" />
              </div>
            </div>

            {/* VIDEO INFORMATION */}

            <div
              className="
              flex min-w-0 flex-1
              flex-col items-start
            "
            >
              {/* Lesson Number */}

              <div
                className="
                flex w-fit items-center gap-5
                border border-white/15
                bg-[#171717]
                px-6 py-3
              "
              >
                <span className="text-3xl font-bold">الدرس</span>

                <span
                  className="
                  font-mono text-4xl font-bold
                  tracking-wider
                "
                >
                  {String(VIDEO.number).padStart(2, "0")}
                </span>
              </div>

              {/* Category */}

              <div className="mt-6 flex items-center gap-3">
                <div
                  className={`
                  h-8 w-1.5 ${VIDEO.category.bg}
                `}
                />

                <CategoryIcon
                  size={23}
                  stroke={1.8}
                  className={VIDEO.category.color}
                />

                <span
                  className={`
                  text-xl font-bold
                  ${VIDEO.category.color}
                `}
                >
                  {VIDEO.category.name}
                </span>
              </div>

              {/* Video Title */}

              <h1
                className="
                mt-7 w-full
                text-right
                text-[72px] font-black
                leading-[1.3]
                tracking-tight
                text-white
                wrap-break-word
                line-clamp-2
              "
              >
                {VIDEO.title}
              </h1>

              {/* Main Accent Line */}

              <div
                className={`
                mt-7 h-1.25 w-[78%]
                ${VIDEO.category.bg}
              `}
              />
            </div>
          </div>

          {/* ==================================
              FOOTER
          ================================== */}

          <div
            className="
            absolute bottom-0 left-0
            p-10
          "
          >
            <span
              className="
              text-3xl font-extrabold
              text-white/65
            "
            >
              شروحات {BRAND.name}
            </span>
          </div>
        </div>
      </div>

      {/* ==================================
          EXPORT INFORMATION
      ================================== */}

      <p
        className="
        mx-auto mt-5 max-w-7xl
        text-center text-sm text-white/40
      "
      >
        PNG · 1280 × 720 px · YouTube Ready
      </p>
    </main>
  );
}
