"use client";

import {
  IconArrowRight,
  IconKeyboard,
  IconPlayerPause,
  IconReceiptRefund,
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
import { useShellData } from "@/hooks/useShellData";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { POS_SHORTCUTS } from "../config/posShortcuts";
import { posUiActions } from "../store/posUiSlice";
import { selectHeld } from "../store/selectors";
import { BRAND } from "@/config/brand";
import { requestReturn } from "../store/posActions";

export function PosTopBar() {
  const dispatch = useAppDispatch();
  const { shift, sync } = useShellData();
  const heldCount = useAppSelector(selectHeld).length;

  return (
    <header className="flex h-14 shrink-0 items-center gap-1 border-b px-2 sm:gap-2 sm:px-3">
      <AppTooltip message="خروج من الكاشير">
        <Button
          variant="ghost"
          size="icon-lg"
          nativeButton={false}
          render={<Link href="/admin/dashboard" />}
          aria-label="خروج من الكاشير"
        >
          <IconArrowRight className="size-5" />
        </Button>
      </AppTooltip>
      <h1 className="text-lg font-bold">{BRAND.name}</h1>
      <BrandLogo variant="icon" />
      <h2 className="hidden text-sm font-semibold sm:block">الكاشير</h2>

      <Separator
        orientation="vertical"
        className="mx-1 hidden data-vertical:h-6 data-vertical:self-center sm:block"
      />

      <ShiftStatus shift={shift} />
      <SyncStatus sync={sync} />

      <div className="ms-auto flex items-center gap-1 sm:gap-2">
        <AppTooltip
          message={`مرتجع أو استبدال (${POS_SHORTCUTS.returns.label})`}
        >
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => dispatch(requestReturn())}
            aria-label="مرتجع أو استبدال"
            className="gap-2 font-normal"
          >
            <IconReceiptRefund className="size-4" />
            <span className="hidden sm:inline">مرتجع</span>
            <ShortcutBadge className="hidden rounded-none lg:inline-flex">
              {POS_SHORTCUTS.returns.label}
            </ShortcutBadge>
          </Button>
        </AppTooltip>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => dispatch(posUiActions.openDialog("held"))}
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
            onClick={() => dispatch(posUiActions.openDialog("shortcuts"))}
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
