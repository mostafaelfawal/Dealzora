import Link from "next/link";

import { BrandLogo } from "@/components/shared/BrandLogo";
import { BRAND } from "@/config/brand";
import { cn } from "@/lib/utils";

interface SidebarBrandProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function SidebarBrand({
  collapsed = false,
  onNavigate,
}: SidebarBrandProps) {
  return (
    <Link
      href="/"
      onClick={onNavigate}
      aria-label={`${BRAND.name} — الرئيسية`}
      className={cn(
        "flex h-14.25 shrink-0 items-center gap-2 border-b px-4 text-lg font-semibold",
        collapsed && "justify-center px-0",
      )}
    >
      <BrandLogo variant="icon" />
      {!collapsed && <span>{BRAND.name}</span>}
    </Link>
  );
}
