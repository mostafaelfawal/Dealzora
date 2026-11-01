import {
  IconBuildingBank,
  IconBuildingStore,
  IconBuildingWarehouse,
  IconCash,
  IconChartBar,
  IconClockHour4,
  IconHistory,
  IconLayoutDashboard,
  IconPackage,
  IconReceipt,
  IconReceiptRefund,
  IconSettings,
  IconTruckDelivery,
  IconUserShield,
  IconUsers,
} from "@tabler/icons-react";

import type { UserRole } from "@/types/auth";
import type { NavGroup } from "@/types/navigation";

/**
 * المجموعات مرتبة حسب سياق يوم التاجر (بيع ← مخزن ← حسابات ← إدارة)
 * مش حسب أسماء الجداول. لإضافة صفحة جديدة ضيف عنصر هنا فقط.
 */
export const NAVIGATION: NavGroup[] = [
  {
    id: "sales",
    label: "البيع",
    items: [
      {
        title: "الرئيسية",
        href: "/",
        icon: IconLayoutDashboard,
      },
      { title: "الفواتير", href: "/sales", icon: IconReceipt },
      { title: "المرتجعات", href: "/returns", icon: IconReceiptRefund },
      { title: "الورديات", href: "/shifts", icon: IconClockHour4 },
    ],
  },
  {
    id: "stock",
    label: "المخزن",
    items: [
      { title: "المنتجات", href: "/products", icon: IconPackage },
      {
        title: "المخزون",
        href: "/inventory",
        icon: IconBuildingWarehouse,
      },
      {
        title: "المشتريات",
        href: "/purchases",
        icon: IconTruckDelivery,
      },
    ],
  },
  {
    id: "accounts",
    label: "الحسابات",
    items: [
      { title: "العملاء", href: "/customers", icon: IconUsers },
      {
        title: "الموردين",
        href: "/suppliers",
        icon: IconBuildingStore,
      },
      {
        title: "المصروفات",
        href: "/expenses",
        icon: IconCash,
      },
      {
        title: "الخزنة",
        href: "/treasury",
        icon: IconBuildingBank,
      },
      {
        title: "التقارير",
        href: "/reports",
        icon: IconChartBar,
      },
    ],
  },
  {
    id: "admin",
    label: "الإدارة",
    items: [
      {
        title: "المستخدمين",
        href: "/users",
        icon: IconUserShield,
      },
      {
        title: "سجل العمليات",
        href: "/audit-log",
        icon: IconHistory,
      },
      {
        title: "الإعدادات",
        href: "/settings",
        icon: IconSettings,
      },
    ],
  },
];

/** يرجّع القائمة بعد إخفاء العناصر الممنوعة (مش تعطيلها) وحذف المجموعات الفاضية. */
export function getNavigationForRole(role: UserRole): NavGroup[] {
  return NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.roles || item.roles.includes(role),
    ),
  })).filter((group) => group.items.length > 0);
}
