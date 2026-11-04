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
        href: "/admin/dashboard",
        icon: IconLayoutDashboard,
      },
      { title: "الفواتير", href: "/admin/sales", icon: IconReceipt },
      { title: "المرتجعات", href: "/admin/returns", icon: IconReceiptRefund },
      { title: "الورديات", href: "/admin/shifts", icon: IconClockHour4 },
    ],
  },
  {
    id: "stock",
    label: "المخزن",
    items: [
      { title: "المنتجات", href: "/admin/products", icon: IconPackage },
      {
        title: "المخزون",
        href: "/admin/inventory",
        icon: IconBuildingWarehouse,
      },
      {
        title: "المشتريات",
        href: "/admin/purchases",
        icon: IconTruckDelivery,
      },
    ],
  },
  {
    id: "accounts",
    label: "الحسابات",
    items: [
      { title: "العملاء", href: "/admin/customers", icon: IconUsers },
      {
        title: "الموردين",
        href: "/admin/suppliers",
        icon: IconBuildingStore,
      },
      {
        title: "المصروفات",
        href: "/admin/expenses",
        icon: IconCash,
      },
      {
        title: "الخزنة",
        href: "/admin/treasury",
        icon: IconBuildingBank,
      },
      {
        title: "التقارير",
        href: "/admin/reports",
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
        href: "/admin/users",
        icon: IconUserShield,
      },
      {
        title: "سجل العمليات",
        href: "/admin/audit-log",
        icon: IconHistory,
      },
      {
        title: "الإعدادات",
        href: "/admin/settings",
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
