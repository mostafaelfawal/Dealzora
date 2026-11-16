"use client";

import { IconLock, IconSparkles } from "@tabler/icons-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { Button } from "@/components/ui/button";
import {
  FEATURE_INFO,
  currentPlanLabel,
  upgradeMessage,
  useFeature,
  usePlan,
  type PlanFeature,
} from "@/lib/plan";
import { cn } from "@/lib/utils";

const SETTINGS_PLANS = "/admin/settings#plans";

/** صفحة كاملة لميزة غير متاحة في الخطة الحالية. */
export function UpgradeNotice({
  feature,
  className,
}: {
  feature: PlanFeature;
  className?: string;
}) {
  const info = FEATURE_INFO[feature];
  const { data: plan } = usePlan();
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
        الحالية {currentPlanLabel(plan ?? null)}
        {!plan || plan.isFree
          ? " للمحل الصغير: جهاز واحد، 300 صنف، والبيع النقدي."
          : "."}
      </p>
      <Button
        nativeButton={false}
        render={<Link href={SETTINGS_PLANS} />}
        className="gap-2"
      >
        <IconSparkles className="size-4" />
        عرض الخطط
      </Button>
    </div>
  );
}

/** يعرض المحتوى لو الميزة متاحة، وإلا رسالة الترقية مكانه. */
export function PlanGate({
  feature,
  children,
  className = "mt-8",
}: {
  feature: PlanFeature;
  children: ReactNode;
  /** مكان رسالة الترقية: صفحة كاملة (الافتراضي) أو داخل قسم إعدادات ("border-0"). */
  className?: string;
}) {
  return useFeature(feature) ? (
    <>{children}</>
  ) : (
    <UpgradeNotice feature={feature} className={className} />
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
