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
        hotkey: 1,
      },
      { title: "الفواتير", href: "/admin/sales", icon: IconReceipt, hotkey: 2 },
      { title: "المرتجعات", href: "/admin/returns", icon: IconReceiptRefund },
      { title: "الورديات", href: "/admin/shifts", icon: IconClockHour4 },
    ],
  },
  {
    id: "stock",
    label: "المخزن",
    items: [
      {
        title: "المنتجات",
        href: "/admin/products",
        icon: IconPackage,
        hotkey: 3,
      },
      {
        title: "المخزون",
        href: "/admin/inventory",
        icon: IconBuildingWarehouse,
        hotkey: 4,
      },
      {
        title: "المشتريات",
        href: "/admin/purchases",
        feature: "suppliers",
        icon: IconTruckDelivery,
        hotkey: 5,
      },
    ],
  },
  {
    id: "accounts",
    label: "الحسابات",
    items: [
      {
        title: "العملاء",
        href: "/admin/customers",
        feature: "customers",
        icon: IconUsers,
        hotkey: 6,
      },
      {
        title: "الموردين",
        href: "/admin/suppliers",
        feature: "suppliers",
        icon: IconBuildingStore,
        hotkey: 7,
      },
      {
        title: "المصروفات",
        href: "/admin/expenses",
        feature: "expenses",
        icon: IconCash,
      },
      {
        title: "الخزنة",
        href: "/admin/treasury",
        feature: "expenses",
        icon: IconBuildingBank,
        hotkey: 8,
      },
      {
        title: "التقارير",
        href: "/admin/reports",
        icon: IconChartBar,
        hotkey: 9,
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
        feature: "audit_log",
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

/** كل الصفحات التي لها رقم اختصار (Alt + رقم). */
export const NAV_HOTKEYS = NAVIGATION.flatMap((g) => g.items).filter(
  (item): item is typeof item & { hotkey: number } => item.hotkey !== undefined,
);
