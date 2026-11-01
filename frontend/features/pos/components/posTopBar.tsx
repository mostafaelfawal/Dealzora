"use client";

import {
  IconArrowRight,
  IconKeyboard,
  IconPlayerPause,
} from "@tabler/icons-react";
import Link from "next/link";

import { ShiftStatus } from "@/components/layout/header/ShiftStatus";
import { SyncStatus } from "@/components/layout/header/SyncStatus";
import { ThemeToggle } from "@/components/layout/header/ThemeToggle";
import { AppTooltip } from "@/components/shared/AppTooltip";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { POS_SHORTCUTS } from "../config/posShortcuts";
import { useShellData } from "@/hooks/useShellData";

interface PosTopBarProps {
  heldCount: number;
  onHeld: () => void;
  onShortcuts: () => void;
}

export function PosTopBar({ heldCount, onHeld, onShortcuts }: PosTopBarProps) {
  const { shift, sync } = useShellData();

  return (
    <header className="flex h-14 shrink-0 items-center gap-1 border-b px-2 sm:gap-2 sm:px-3">
      <AppTooltip message="خروج من الكاشير">
        <Button
          variant="ghost"
          size="icon-lg"
          nativeButton={false}
          render={<Link href="/main" />}
          aria-label="خروج من الكاشير"
        >
          <IconArrowRight className="size-5" />
        </Button>
      </AppTooltip>

      <BrandLogo variant="icon" />
      <h1 className="hidden text-sm font-semibold sm:block">الكاشير</h1>

      <Separator
        orientation="vertical"
        className="mx-1 hidden data-vertical:h-6 data-vertical:self-center sm:block"
      />

      <ShiftStatus shift={shift} />
      <SyncStatus sync={sync} />

      <div className="ms-auto flex items-center gap-1 sm:gap-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onHeld}
          aria-label={`الفواتير المعلّقة (${heldCount})`}
          className="gap-2 font-normal"
        >
          <IconPlayerPause className="size-4" />
          <span className="hidden sm:inline">المعلّقة</span>
          {heldCount > 0 && <Badge>{heldCount}</Badge>}
          <ShortcutBadge className="hidden rounded-none lg:inline-flex">
            {POS_SHORTCUTS.heldList.label}
          </ShortcutBadge>
        </Button>

        <AppTooltip message={`الاختصارات (${POS_SHORTCUTS.help.label})`}>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            aria-label="الاختصارات"
            onClick={onShortcuts}
            className="hidden lg:inline-flex"
          >
            <IconKeyboard className="size-5" />
          </Button>
        </AppTooltip>

        <div className="hidden sm:block">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
