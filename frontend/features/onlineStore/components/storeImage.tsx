"use client";

import { IconPhoto } from "@tabler/icons-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

/** صورة صنف/شعار من سيرفر الفروع، وبديل هادئ بأول حرف لو لا توجد صورة أو فشل تحميلها. */
export function StoreImage({
  base,
  id,
  previewUrl,
  name,
  className,
}: {
  base: string | null | undefined;
  id: string | null | undefined;
  /** صورة محلية رُفعت للتو (قبل أن يُعاد تحميل القائمة). */
  previewUrl?: string | null;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const src = previewUrl ?? (base && id ? `${base}${id}` : null);
  if (src && failed !== src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- صورة خارجية في تطبيق مُصدَّر ثابتاً
      <img
        src={src}
        alt={name}
        loading="lazy"
        onError={() => setFailed(src)}
        className={cn("bg-muted object-cover", className)}
      />
    );
  }
  const letter = name.trim().charAt(0);
  return (
    <span
      aria-hidden
      className={cn(
        "flex items-center justify-center bg-muted text-muted-foreground",
        className,
      )}
    >
      {letter ? (
        <span className="text-lg font-semibold">{letter}</span>
      ) : (
        <IconPhoto className="size-5" />
      )}
    </span>
  );
}
