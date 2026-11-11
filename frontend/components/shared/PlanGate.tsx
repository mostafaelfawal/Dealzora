"use client";

import { IconLock, IconSparkles } from "@tabler/icons-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { Button } from "@/components/ui/button";
import {
  FEATURE_INFO,
  upgradeMessage,
  useFeature,
  type PlanFeature,
} from "@/lib/plan";
import { cn } from "@/lib/utils";

const SETTINGS_LICENSE = "/admin/settings#license";

/** صفحة كاملة لميزة غير متاحة في الخطة الحالية. */
export function UpgradeNotice({
  feature,
  className,
}: {
  feature: PlanFeature;
  className?: string;
}) {
  const info = FEATURE_INFO[feature];
  return (
    <div
      className={cn(
        "mx-auto flex max-w-md flex-col items-center gap-3 border bg-card p-8 text-center",
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <IconLock className="size-6" />
      </span>
      <h2 className="text-lg font-semibold">{info.name}</h2>
      <p className="text-sm text-muted-foreground">
        متاحة من خطة <b className="text-foreground">«{info.plan}»</b>. خطتك
        الحالية «بَسطة» المجانية للمحل الصغير: جهاز واحد، 300 صنف، والبيع الكاش.
      </p>
      <Button
        nativeButton={false}
        render={<Link href={SETTINGS_LICENSE} />}
        className="gap-2"
      >
        <IconSparkles className="size-4" />
        ترقية الخطة
      </Button>
    </div>
  );
}

/** يعرض المحتوى لو الميزة متاحة، وإلا رسالة الترقية مكانه. */
export function PlanGate({
  feature,
  children,
}: {
  feature: PlanFeature;
  children: ReactNode;
}) {
  return useFeature(feature) ? (
    <>{children}</>
  ) : (
    <UpgradeNotice feature={feature} className="mt-8" />
  );
}

/** قفل صغير بجانب زر/عنصر مع تلميح يشرح الخطة المطلوبة. */
export function PlanLock({
  feature,
  className,
}: {
  feature: PlanFeature;
  className?: string;
}) {
  return (
    <AppTooltip message={upgradeMessage(feature)}>
      <span
        className={cn("inline-flex text-muted-foreground", className)}
        aria-label={upgradeMessage(feature)}
      >
        <IconLock className="size-3.5" />
      </span>
    </AppTooltip>
  );
}
