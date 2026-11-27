import type { Icon } from "@tabler/icons-react";

import type { PlanFeature } from "@/lib/plan";
import type { UserRole } from "@/types/auth";

export interface NavItem {
  title: string;
  href: string;
  icon: Icon;
  /** الأدوار المسموح لها برؤية العنصر. لو متحددش يظهر للكل. */
  roles?: UserRole[];
  /** رقم الاختصار: Alt + الرقم ينقل للصفحة من أي مكان. */
  hotkey?: number;
  /** ميزة الخطة المطلوبة: يظهر قفل صغير لو غير متاحة (الصفحة تعرض رسالة الترقية). */
  feature?: PlanFeature;
}

export interface NavGroup {
  id: string;
  /** اسم المجموعة: عنوانها القابل للطي في القائمة الموسّعة. */
  label: string;
  items: NavItem[];
}
