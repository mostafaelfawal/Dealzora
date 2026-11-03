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
        href: "/main/dashboard",
        icon: IconLayoutDashboard,
      },
      { title: "الفواتير", href: "/main/sales", icon: IconReceipt },
      { title: "المرتجعات", href: "/main/returns", icon: IconReceiptRefund },
      { title: "الورديات", href: "/main/shifts", icon: IconClockHour4 },
    ],
  },
  {
    id: "stock",
    label: "المخزن",
    items: [
      { title: "المنتجات", href: "/main/products", icon: IconPackage },
      {
        title: "المخزون",
        href: "/main/inventory",
        icon: IconBuildingWarehouse,
      },
      {
        title: "المشتريات",
        href: "/main/purchases",
        icon: IconTruckDelivery,
      },
    ],
  },
  {
    id: "accounts",
    label: "الحسابات",
    items: [
      { title: "العملاء", href: "/main/customers", icon: IconUsers },
      {
        title: "الموردين",
        href: "/main/suppliers",
        icon: IconBuildingStore,
      },
      {
        title: "المصروفات",
        href: "/main/expenses",
        icon: IconCash,
      },
      {
        title: "الخزنة",
        href: "/main/treasury",
        icon: IconBuildingBank,
      },
      {
        title: "التقارير",
        href: "/main/reports",
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
        href: "/main/users",
        icon: IconUserShield,
      },
      {
        title: "سجل العمليات",
        href: "/main/audit-log",
        icon: IconHistory,
      },
      {
        title: "الإعدادات",
        href: "/main/settings",
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
