"use client";

import { IconLockDollar, IconPlayerPlay } from "@tabler/icons-react";
import { useState } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { ViewToggle } from "@/components/shared/ViewToggle";
import { Button } from "@/components/ui/button";
import { useHotkey } from "@/hooks/useHotkey";
import { useViewMode } from "@/hooks/useViewMode";

import { SHIFT_PAGE_SIZES, SHIFTS_SHORTCUTS } from "../config/shiftOptions";
import { useCurrentShift, useShiftsList } from "../hooks/useShifts";
import { CloseShiftDialog, OpenShiftDialog } from "./shiftDialogs";
import { ShiftsStats } from "./shiftsStats";
import { ShiftsTable } from "./shiftsTable";

type ShiftDialog = "open" | "close" | null;

/** الورديات: الوردية الحالية + سجل الورديات السابقة بالمتوقع والفعلي والفرق. */
export function ShiftsScreen() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(SHIFT_PAGE_SIZES[0]);
  const [dialog, setDialog] = useState<ShiftDialog>(null);
  const { view, setView } = useViewMode("shifts");
  const list = useShiftsList(page, pageSize);
  const shift = useCurrentShift().data ?? null;
  const lastClosed = list.data?.items.find((s) => !s.isOpen) ?? null;

  // زر واحد واختصار واحد: يفتح وردية أو يقفل الحالية.
  const toggleShift = () => setDialog(shift ? "close" : "open");

  useHotkey(SHIFTS_SHORTCUTS.toggleShift.match, () => {
    if (!dialog) toggleShift();
  });

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <PageHeader
        title="الورديات"
        description="كل وردية تبدأ بفكّة الدرج وتنتهي بجرده. الفرق (عجز أو زيادة) يُسجَّل في الخزنة تلقائياً."
        actions={
          <>
            <ViewToggle view={view} onChange={setView} hotkey={!dialog} />
            <Button
              size="lg"
              variant={shift ? "outline" : "default"}
              onClick={toggleShift}
              className="h-10 gap-2"
            >
              {shift ? (
                <IconLockDollar className="size-4" />
              ) : (
                <IconPlayerPlay className="size-4" />
              )}
              {shift ? "قفل الوردية الحالية" : "فتح وردية"}
              <ShortcutBadge className="hidden lg:inline-flex">
                {SHIFTS_SHORTCUTS.toggleShift.label}
              </ShortcutBadge>
            </Button>
          </>
        }
      />

      <ShiftsStats current={shift} lastClosed={lastClosed} />

      <ShiftsTable
        list={list}
        view={view}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        emptyAction={
          <Button size="lg" onClick={() => setDialog("open")} className="gap-2">
            <IconPlayerPlay className="size-4" />
            فتح وردية
          </Button>
        }
      />

      <OpenShiftDialog
        open={dialog === "open"}
        onClose={() => setDialog(null)}
      />
      <CloseShiftDialog
        shift={shift}
        open={dialog === "close"}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
