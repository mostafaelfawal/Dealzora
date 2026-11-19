"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

import { ProductImage } from "./productCard";

/** صور الصنف: الصورة الكبيرة، وتحتها المصغّرات للتبديل بينها (تظهر فقط عند أكثر من صورة). */
export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  const current = images[active] ?? images[0] ?? null;

  return (
    <div className="space-y-2">
      <ProductImage url={current} name={name} className="aspect-square border" />
      {images.length > 1 && (
        <div role="tablist" aria-label="صور الصنف" className="no-scrollbar flex gap-2 overflow-x-auto">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`الصورة ${i + 1}`}
              onClick={() => setActive(i)}
              className={cn(
                "size-16 shrink-0 overflow-hidden border-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:size-20",
                i === active ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- صور مضغوطة مسبقاً من السيرفر نفسه */}
              <img src={src} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
