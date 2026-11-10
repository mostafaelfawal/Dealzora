"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/types/navigation";

interface SidebarNavItemProps {
  item: NavItem;
  collapsed: boolean;
  pendingHref?: string | null;
  onNavigate?: () => void;
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNavItem({
  item,
  collapsed,
  pendingHref = null,
  onNavigate,
}: SidebarNavItemProps) {
  const pathname = usePathname();
  const active = pendingHref
    ? pendingHref === item.href
    : isActivePath(pathname, item.href);
  const Icon = item.icon;

  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.title : undefined}
      className={cn(
        "group/item relative flex h-11 items-center gap-3 rounded-none px-3 text-sm text-muted-foreground outline-none transition-colors lg:h-10",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        collapsed && "justify-center px-0",
        active &&
          "bg-sidebar-accent font-medium text-primary hover:text-primary",
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute inset-y-2 right-0 w-0.5 rounded-full bg-primary"
        />
      )}
      <Icon
        className={cn(
          "size-5 shrink-0 transition-transform duration-200 ease-out",
          "motion-safe:group-hover/item:scale-110 motion-safe:group-hover/item:-rotate-6",
          "motion-safe:group-active/item:scale-95",
          active && "motion-safe:animate-icon-pop",
        )}
      />
      {!collapsed && <span className="truncate">{item.title}</span>}
      {!collapsed && item.hotkey !== undefined && (
        <kbd
          dir="ltr"
          aria-hidden
          className="ms-auto hidden font-mono text-[10px] text-muted-foreground/70 opacity-0 transition-opacity group-hover/item:opacity-100 lg:inline"
        >
          Alt {item.hotkey}
        </kbd>
      )}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <AppTooltip
      message={
        item.hotkey !== undefined
          ? `${item.title} (Alt ${item.hotkey})`
          : item.title
      }
      side="left"
    >
      {link}
    </AppTooltip>
  );
}
