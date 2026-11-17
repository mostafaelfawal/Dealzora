import {
  IconBasket,
  IconBuildingCommunity,
  IconBuildingStore,
  IconShoppingCart,
  type Icon,
} from "@tabler/icons-react";

import type { PlanInfo } from "@/lib/plan";

type PlanId = PlanInfo["plan"];

/** أيقونة كل خطة: نفسها في صفحة الخطط وفي شارة الشريط الجانبي. */
export const PLAN_ICON: Record<PlanId, Icon> = {
  free: IconBasket,
  basic: IconBuildingStore,
  pro: IconShoppingCart,
  enterprise: IconBuildingCommunity,
};

/** لون شارة الخطة (حدود وخلفية خفيفة ونص) في الوضعين الفاتح والداكن. */
export const PLAN_BADGE_CLASS: Record<PlanId, string> = {
  free: "border-border bg-muted text-muted-foreground",
  basic:
    "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  pro: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  enterprise:
    "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
};
