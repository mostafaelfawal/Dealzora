import {
  IconBuildingStore,
  IconCashRegister,
  IconChartBar,
  IconDatabaseExport,
  IconPackage,
  IconShieldLock,
  IconTruckDelivery,
  IconUsers,
  IconWallet,
} from "@tabler/icons-react";
import type { ComponentType } from "react";

export interface ShowcaseFeature {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}

export const SHOWCASE_TAGLINE = "نظام كاشير ومخزون متكامل لمحلك";
export const SHOWCASE_SUBTITLE =
  "من أول صنف لآخر فاتورة: بيع أسرع، مخزون مضبوط، وحسابات واضحة. يعمل على جهازك حتى بدون إنترنت.";

export const SHOWCASE_FEATURES: ShowcaseFeature[] = [
  {
    title: "المنتجات والمخزون",
    description: "باركود، وحدات بيع، تنبيه النواقص، جرد، واستيراد من Excel.",
    icon: IconPackage,
  },
  {
    title: "نقطة البيع",
    description: "بحث سريع، خصومات، بيع نقدي وآجل، مرتجعات، وطباعة حرارية.",
    icon: IconCashRegister,
  },
  {
    title: "العملاء والموردون",
    description: "كشف حساب، مديونيات، تحصيل دفعات، وحد ائتماني.",
    icon: IconUsers,
  },
  {
    title: "المشتريات",
    description: "فواتير شراء تحدّث المخزون وسعر الشراء تلقائياً.",
    icon: IconTruckDelivery,
  },
  {
    title: "التقارير",
    description: "مبيعات وأرباح لكل صنف، الأكثر مبيعاً، النواقص والراكد.",
    icon: IconChartBar,
  },
  {
    title: "المصروفات والخزنة",
    description: "تسجيل المصاريف وحركة الخزنة اليومية داخل/خارج.",
    icon: IconWallet,
  },
  {
    title: "الصلاحيات وسجل العمليات",
    description: "مدير وكاشير، والكاشير لا يرى الأرباح ولا سعر الشراء.",
    icon: IconShieldLock,
  },
  {
    title: "نسخ احتياطي",
    description: "نسخة مشفّرة تلقائية كل يوم، واستعادة بضغطة.",
    icon: IconDatabaseExport,
  },
];

export const SHOWCASE_ICON = IconBuildingStore;
