"use client";

import { usePathname } from "next/navigation";
import { Fragment, useState } from "react";

import { Separator } from "@/components/ui/separator";
import { getNavigationForRole } from "@/config/navigation";
import { useShellData } from "@/hooks/useShellData";

import { SidebarNavItem } from "./SidebarNavItem";

interface SidebarNavProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

interface PendingNav {
  href: string;
  fromPath: string;
}

export function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  const { user } = useShellData();
  const pathname = usePathname();
  const groups = getNavigationForRole(user.role);
  const [pending, setPending] = useState<PendingNav | null>(null);

  const pendingHref = pending?.fromPath === pathname ? pending.href : null;

  function handleNavigate(href: string) {
    setPending({ href, fromPath: pathname });
    onNavigate?.();
  }

  return (
    <nav aria-label="القائمة الرئيسية" className="flex-1 overflow-y-auto p-2">
      {groups.map((group, index) => (
        <Fragment key={group.id}>
          {index > 0 && (
            <div className="relative">
              <Separator className="my-2" />
              <span
                className={`text-xs px-1 text-muted-foreground shadow-sm absolute -top-2 right-5 bg-background ${collapsed ? "hidden" : "inline"}`}
              >
                {group.label}
              </span>
            </div>
          )}
          <ul aria-label={group.label} className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <SidebarNavItem
                  item={item}
                  collapsed={collapsed}
                  pendingHref={pendingHref}
                  onNavigate={() => handleNavigate(item.href)}
                />
              </li>
            ))}
          </ul>
        </Fragment>
      ))}
    </nav>
  );
}
