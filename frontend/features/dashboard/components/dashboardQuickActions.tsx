"use client";

import {
  IconBox,
  IconPlus,
  IconShoppingCartPlus,
  IconTruckDelivery,
} from "@tabler/icons-react";
import Link from "next/link";
import type { ComponentType } from "react";

import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";
import { SHORTCUTS } from "@/config/shortcuts";

const SECONDARY_ACTIONS: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  {
    href: "/admin/purchases/new",
    label: "فاتورة شراء",
    icon: IconTruckDelivery,
  },
  { href: "/admin/products/new", label: "صنف جديد", icon: IconPlus },
  { href: "/admin/inventory", label: "جرد المخزون", icon: IconBox },
];

/** أكثر الإجراءات استخداماً في يوم العمل. */
export function DashboardQuickActions() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="lg"
        nativeButton={false}
        render={<Link href="/pos" />}
        className="h-10 gap-2"
      >
        <IconShoppingCartPlus className="size-4" />
        بيع جديد
        <ShortcutBadge className="hidden border-primary-foreground/30 text-primary-foreground/80 lg:inline-flex">
          {SHORTCUTS.newSale.label}
        </ShortcutBadge>
      </Button>
      {SECONDARY_ACTIONS.map(({ href, label, icon: Icon }) => (
        <Button
          key={href}
          size="lg"
          variant="outline"
          nativeButton={false}
          render={<Link href={href} />}
          className="h-10 gap-2 font-normal"
        >
          <Icon className="size-4" />
          {label}
        </Button>
      ))}
    </div>
  );
}
