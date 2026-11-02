"use client";

import { Money } from "@/components/shared/Money";
import { Button } from "@/components/ui/button";
import { formatItemCount } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { cn } from "cn";
import { usePosFocus } from "../hooks/usePosFocus";
import { usePosHotkeys } from "../hooks/usePosHotkeys";
import { usePosPersistence } from "../hooks/usePosPersistence";
import { posUiActions } from "../store/posUiSlice";
import { selectTotals } from "../store/selectors";

import { PosCancelDialog } from "./posCancelDialog";
import { PosCartPanel } from "./posCartPanel";
import { PosCustomerDialog } from "./posCustomerDialog";
import { PosDiscountDialog } from "./posDiscountDialog";
import { PosHeldDialog } from "./posHeldDialog";
import { PosPaymentDialog } from "./posPaymentDialog";
import { PosProductPane } from "./posProductPane";
import { PosShortcutsDialog } from "./posShortcutsDialog";
import { PosTopBar } from "./posTopBar";
import { IconInvoice } from "@tabler/icons-react";

/** شريط الإجمالي السفلي على الموبايل (من شاشة الأصناف إلى الفاتورة). */
function MobileCartBar() {
  const dispatch = useAppDispatch();
  const { itemCount, total } = useAppSelector(selectTotals);

  return (
    <div className="flex shrink-0 items-center gap-3 border-t bg-background p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">
          {formatItemCount(itemCount)}
        </p>
        <Money amount={total} className="text-2xl leading-none" />
      </div>
      <Button
        type="button"
        size="lg"
        className="h-11 px-5 text-sm"
        onClick={() => dispatch(posUiActions.setMobileView("cart"))}
      >
        <IconInvoice />
        عرض الفاتورة
      </Button>
    </div>
  );
}

/** هيكل الشاشة فقط. كل حالة وكل منطق في الـ store والـ hooks. */
export function PosWorkspace() {
  const mobileView = useAppSelector((s) => s.posUi.mobileView);

  usePosPersistence();
  usePosHotkeys();
  const handleRootClick = usePosFocus();

  return (
    <div
      onClick={handleRootClick}
      className="flex h-dvh flex-col overflow-hidden bg-background text-foreground"
    >
      <PosTopBar />

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <PosProductPane
          className={cn("flex", mobileView === "cart" && "hidden lg:flex")}
        />
        <PosCartPanel
          className={cn("flex", mobileView === "products" && "hidden lg:flex")}
        />
      </div>

      {mobileView === "products" && <MobileCartBar />}

      <PosPaymentDialog />
      <PosDiscountDialog />
      <PosCustomerDialog />
      <PosHeldDialog />
      <PosCancelDialog />
      <PosShortcutsDialog />
    </div>
  );
}
