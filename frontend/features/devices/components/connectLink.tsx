"use client";

import { IconBuildingStore, IconPlugConnected } from "@tabler/icons-react";
import Link from "next/link";

import { isTerminal, useDeviceConfig } from "@/lib/device";

/** تحت نموذج الدخول/الإعداد: مدخل جهاز الكاشير للربط بالجهاز الأساسي. */
export function ConnectLink({ withBranch = false }: { withBranch?: boolean }) {
  const cfg = useDeviceConfig();
  if (!cfg) return null;

  if (isTerminal(cfg)) {
    return (
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <IconPlugConnected className="size-3.5 text-primary" />
        جهاز كاشير «{cfg.device_name}» متصل بـ
        <bdi dir="ltr" className="font-mono">
          {cfg.main_url?.replace(/^https?:\/\//, "")}
        </bdi>
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <Link
        href="/connect"
        className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
      >
        <IconPlugConnected className="size-3.5" />
        هذا جهاز كاشير إضافي؟ اربطه بالجهاز الأساسي في المحل
      </Link>
      {withBranch && (
        <Link
          href="/join-branch"
          className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
        >
          <IconBuildingStore className="size-3.5" />
          فرع جديد لمحل موجود؟ اربطه بكود من المالك
        </Link>
      )}
    </div>
  );
}
