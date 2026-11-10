import type { Icon } from "@tabler/icons-react";

import type { UserRole } from "@/types/auth";

export interface NavItem {
  title: string;
  href: string;
  icon: Icon;
  /** الأدوار المسموح لها برؤية العنصر. لو متحددش يظهر للكل. */
  roles?: UserRole[];
  /** رقم الاختصار: Alt + الرقم ينقل للصفحة من أي مكان. */
  hotkey?: number;
}

export interface NavGroup {
  id: string;
  /** اسم المجموعة (للقارئات الصوتية فقط، مفيش عناوين ظاهرة). */
  label: string;
  items: NavItem[];
}
