"use client";

import { IconCopy, IconExternalLink, IconWorldWww } from "@tabler/icons-react";
import { toast } from "sonner";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { Button } from "@/components/ui/button";
import { openExternal } from "@/lib/external";
import { cn } from "@/lib/utils";

import type { StoreSettings } from "../types/store";

/** رابط المتجر العام: نسخ للمشاركة وفتح في المتصفح، مع حالة النشر بوضوح. */
export function StoreLinkBar({ store }: { store: StoreSettings }) {
  const url = store.url;
  const copy = () => {
    if (!url) return;
    void navigator.clipboard
      ?.writeText(url)
      .then(() => toast.success("نُسخ رابط المتجر", { description: url }));
  };
  const open = () => {
    if (!url) return;
    // البرنامج يفتح روابط من قائمة بيضاء فقط (عنوان المتجر يُضبط وقت بناء البرنامج):
    // لو لم يُسمح بالرابط ننسخه بدل رسالة خطأ بلا حل.
    openExternal(url).catch(() => {
      void navigator.clipboard
        ?.writeText(url)
        .then(() =>
          toast.info("نُسخ رابط المتجر", {
            description: "الصقه في المتصفح لفتح المتجر.",
          }),
        )
        .catch(() => toast.error("تعذّر فتح المتصفح. انسخ الرابط وافتحه يدوياً"));
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border bg-card p-2 ps-3">
      <span
        className={cn(
          "flex items-center gap-1.5 px-1.5 py-0.5 text-[11px] font-medium",
          store.live
            ? "bg-success/10 text-success"
            : "bg-muted text-muted-foreground",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "size-1.5 rounded-full",
            store.live ? "animate-pulse bg-success" : "bg-muted-foreground",
          )}
        />
        {store.live ? "منشور" : "غير منشور"}
      </span>
      <IconWorldWww className="size-4 shrink-0 text-muted-foreground" />
      <AppTooltip message={url ?? store.slug} onlyWhenTruncated>
        <span
          dir="ltr"
          className="min-w-0 flex-1 truncate text-start font-mono text-xs"
        >
          {url ?? `…/${store.slug}`}
        </span>
      </AppTooltip>
      <div className="ms-auto flex gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={copy}
          disabled={!url}
        >
          <IconCopy className="size-4" />
          نسخ الرابط
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={open}
          disabled={!url}
        >
          <IconExternalLink className="size-4" />
          فتح المتجر
        </Button>
      </div>
    </div>
  );
}
