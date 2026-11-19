"use client";

import {
  IconArrowsSort,
  IconCheck,
  IconChevronDown,
  IconRestore,
} from "@tabler/icons-react";
import { usePathname } from "next/navigation";
import { Fragment, useState, type ReactNode } from "react";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getNavigationForRole } from "@/config/navigation";
import { useShellData } from "@/hooks/useShellData";
import { applySidebarLayout, useSidebarLayout } from "@/hooks/useSidebarLayout";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/types/navigation";

import { SidebarNavItem } from "./SidebarNavItem";
import { SidebarReorderList } from "./SidebarReorderList";

interface SidebarNavProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

interface PendingNav {
  href: string;
  fromPath: string;
}

const DEMOTED_LABEL = "أقل استخداماً";

function SectionLabel({
  collapsed,
  children,
}: {
  collapsed: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <Separator className="my-2" />
      <span
        className={cn(
          "absolute -top-2 right-5 bg-background px-1 text-xs text-muted-foreground shadow-sm",
          collapsed ? "hidden" : "inline",
        )}
      >
        {children}
      </span>
    </div>
  );
}

export function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  const { user } = useShellData();
  const pathname = usePathname();
  const {
    layout,
    setGroupOrder,
    setDemotedOrder,
    demote,
    restore,
    toggleDemotedOpen,
    reset,
  } = useSidebarLayout();
  const { groups, demoted } = applySidebarLayout(
    getNavigationForRole(user.role),
    layout,
  );
  const [pending, setPending] = useState<PendingNav | null>(null);
  const [editingState, setEditing] = useState(false);
  // القائمة المطوية ضيقة جداً على السحب: التخصيص من القائمة الموسّعة فقط.
  const editing = editingState && !collapsed;

  const pendingHref = pending?.fromPath === pathname ? pending.href : null;
  const customized =
    layout.demoted.length > 0 || Object.keys(layout.order).length > 0;

  function handleNavigate(href: string) {
    setPending({ href, fromPath: pathname });
    onNavigate?.();
  }

  function renderLinks(items: NavItem[], label: string) {
    return (
      <ul aria-label={label} className="space-y-0.5">
        {items.map((item) => (
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
    );
  }

  // الصفحة الحالية لو كانت في "أقل استخداماً" تفتح القسم حتى يراها المستخدم.
  const activeDemoted = demoted.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  const demotedOpen = editing || layout.demotedOpen || activeDemoted;
  const toggleLabel = `${demotedOpen ? "إخفاء" : "إظهار"} ${DEMOTED_LABEL} (${demoted.length})`;

  return (
    <nav aria-label="القائمة الرئيسية" className="flex-1 overflow-y-auto p-2">
      {groups.map((group, index) => (
        <Fragment key={group.id}>
          {index > 0 && (
            <SectionLabel collapsed={collapsed}>{group.label}</SectionLabel>
          )}
          {editing ? (
            <SidebarReorderList
              label={group.label}
              items={group.items}
              onReorder={(hrefs) => setGroupOrder(group.id, hrefs)}
              move="down"
              onMove={demote}
            />
          ) : (
            renderLinks(group.items, group.label)
          )}
        </Fragment>
      ))}

      {demoted.length > 0 && (
        <>
          <SectionLabel collapsed={collapsed}>{DEMOTED_LABEL}</SectionLabel>
          {!editing && (
            <AppTooltip message={toggleLabel} side="left" disabled={!collapsed}>
              <Button
                type="button"
                variant="ghost"
                onClick={toggleDemotedOpen}
                disabled={activeDemoted}
                aria-expanded={demotedOpen}
                aria-label={collapsed ? toggleLabel : undefined}
                className={cn(
                  "mb-0.5 h-9 w-full justify-start gap-3 px-3 text-xs font-normal text-muted-foreground",
                  collapsed && "justify-center px-0",
                )}
              >
                <IconChevronDown
                  className={cn(
                    "size-4 shrink-0 transition-transform motion-reduce:transition-none",
                    demotedOpen && "rotate-180",
                  )}
                />
                {!collapsed && (
                  <span>
                    {demotedOpen ? "إخفاء" : "إظهار"} الصفحات ({demoted.length})
                  </span>
                )}
              </Button>
            </AppTooltip>
          )}
          {editing ? (
            <SidebarReorderList
              label={DEMOTED_LABEL}
              items={demoted}
              onReorder={setDemotedOrder}
              move="up"
              onMove={restore}
            />
          ) : (
            demotedOpen && renderLinks(demoted, DEMOTED_LABEL)
          )}
        </>
      )}

      {!collapsed && (
        <div className="mt-3 border-t pt-2">
          {editing && (
            <p className="mb-2 px-1 text-[11px] leading-relaxed text-muted-foreground">
              اسحب من المقبض لتغيير الترتيب، أو انقل ما لا تستعمله إلى{" "}
              {DEMOTED_LABEL}.
            </p>
          )}
          <div className="flex gap-1">
            <Button
              type="button"
              variant={editing ? "default" : "ghost"}
              size="sm"
              onClick={() => setEditing(!editing)}
              aria-pressed={editing}
              className={cn(
                "flex-1 justify-start gap-2",
                !editing && "font-normal text-muted-foreground",
              )}
            >
              {editing ? (
                <IconCheck className="size-4" />
              ) : (
                <IconArrowsSort className="size-4" />
              )}
              {editing ? "تم" : "تخصيص القائمة"}
            </Button>
            {editing && customized && (
              <AppTooltip message="استعادة الترتيب الافتراضي">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={reset}
                  aria-label="استعادة الترتيب الافتراضي"
                  className="size-8"
                >
                  <IconRestore className="size-4" />
                </Button>
              </AppTooltip>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
