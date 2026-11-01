"use client";

import {
  IconLayoutSidebarRightCollapse,
  IconLayoutSidebarRightExpand,
} from "@tabler/icons-react";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { Button } from "@/components/ui/button";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import { cn } from "@/lib/utils";

import { SidebarBrand } from "./SidebarBrand";
import { SidebarNav } from "./SidebarNav";

export function AppSidebar() {
  const { collapsed, toggle } = useSidebarCollapsed();

  const ToggleIcon = collapsed
    ? IconLayoutSidebarRightExpand
    : IconLayoutSidebarRightCollapse;
  const toggleLabel = collapsed ? "توسيع القائمة" : "طي القائمة";

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-e bg-sidebar text-sidebar-foreground transition-[width] duration-200 motion-reduce:transition-none lg:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <SidebarBrand collapsed={collapsed} />
      <SidebarNav collapsed={collapsed} />

      <div className="shrink-0 border-t p-2">
        <AppTooltip message={toggleLabel} side="left" disabled={!collapsed}>
          <Button
            variant="ghost"
            onClick={toggle}
            aria-label={toggleLabel}
            aria-expanded={!collapsed}
            className={cn(
              "h-10 w-full justify-start gap-3 px-3 font-normal text-muted-foreground",
              collapsed && "justify-center px-0",
            )}
          >
            <ToggleIcon className="size-5 shrink-0" />
            {!collapsed && <span className="text-sm">{toggleLabel}</span>}
          </Button>
        </AppTooltip>
      </div>
    </aside>
  );
}
