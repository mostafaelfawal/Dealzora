"use client";

import { Separator } from "@/components/ui/separator";
import { useShellData } from "@/hooks/useShellData";

import { GlobalSearch } from "./GlobalSearch";
import { HeaderStatus } from "./HeaderStatus";
import { MobileNav } from "./MobileNav";
import { NewSaleButton } from "./NewSaleButton";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

export function AppHeader() {
  const { user } = useShellData();

  return (
    <header className="shrink-0 border-b bg-background">
      {/* الصف الأساسي */}
      <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <MobileNav />
        <NewSaleButton />

        <div className="min-w-0 flex-1">
          <GlobalSearch />
        </div>

        <HeaderStatus className="hidden lg:flex" />
        <Separator orientation="vertical" className="mx-1 hidden lg:block" />
        <div className="hidden sm:block">
          <ThemeToggle />
        </div>
        <UserMenu user={user} />
      </div>

      {/* شريط الحالة للموبايل والتابلت */}
      <div className="no-scrollbar flex h-10 items-center gap-1 overflow-x-auto border-t px-2 lg:hidden">
        <HeaderStatus showLabels className="flex" />
        <div className="ms-auto sm:hidden">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
