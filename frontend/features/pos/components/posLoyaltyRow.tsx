"use client";

import { IconGift, IconMinus, IconPlus, IconX } from "@tabler/icons-react";
import { useState } from "react";

import { Money } from "@/components/shared/Money";
import { Num } from "@/components/shared/Num";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatQty } from "@/lib/format";
import { maxRedeemable, redeemDiscount, useLoyaltyConfig } from "@/lib/loyalty";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";

import { POS_SHORTCUTS } from "../config/posShortcuts";
import { cartActions } from "../store/cartSlice";
import { posUiActions } from "../store/posUiSlice";
import {
  selectInvoiceCustomer,
  selectIsEmpty,
  selectTotals,
} from "../store/selectors";

/**
 * نقاط الولاء في الفاتورة (تظهر دائماً والميزة مفعّلة):
 * بدون عميل ← تذكير باختياره. مع عميل ← رصيده، زر «استبدال النقاط»، وكام هيكسب.
 * لو الاستبدال غير ممكن يظهر السبب بدل أن يختفي الزر.
 */
export function PosLoyaltyRow() {
  const dispatch = useAppDispatch();
  const cfg = useLoyaltyConfig();
  const customer = useAppSelector(selectInvoiceCustomer);
  const totals = useAppSelector(selectTotals);
  const empty = useAppSelector(selectIsEmpty);
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState(0);

  if (!cfg.enabled) return null;

  if (!customer) {
    return (
      <div className="flex items-center justify-between gap-2 bg-success/5 px-2 py-1.5">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <IconGift className="size-3.5 text-success" />
          نقاط الولاء: اختار العميل عشان يكسب ويستبدل
        </span>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => dispatch(posUiActions.openDialog("customer"))}
        >
          اختيار العميل ({POS_SHORTCUTS.customer.label})
        </Button>
      </div>
    );
  }

  const balance = customer.loyaltyPoints ?? 0;
  const base = totals.subtotal - totals.discountAmount;
  const max = maxRedeemable(cfg, balance, base);
  const step = cfg.redeemPoints;
  const redeemed = totals.redeemPoints;

  // أقل فاتورة تسمح بباقة واحدة (حسب أقصى نسبة).
  const minInvoice =
    Math.ceil(((cfg.redeemValue * 100) / cfg.maxRedeemPercent) * 100) / 100;
  const reason = empty
    ? "أضف أصنافاً أولاً"
    : balance < step
      ? `يحتاج ${step} نقطة للاستبدال`
      : max === 0
        ? `الاستبدال لفاتورة ${formatQty(minInvoice)} أو أكثر`
        : null;

  function openDialog() {
    setPoints(redeemed || max);
    setOpen(true);
  }

  return (
    <>
      <div className="space-y-1 bg-success/5 px-2 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <IconGift className="size-3.5 shrink-0 text-success" />
            <span className="truncate">
              نقاط {customer.name}:{" "}
              <Num className="font-semibold text-foreground">{balance}</Num>
            </span>
          </span>
          {redeemed > 0 ? (
            <span className="flex items-center gap-1 text-success">
              خصم <Num>{redeemed}</Num> نقطة −
              <Money amount={totals.loyaltyDiscount} />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="إلغاء استبدال النقاط"
                onClick={() => dispatch(cartActions.setRedeemPoints(0))}
              >
                <IconX />
              </Button>
            </span>
          ) : (
            <Button
              type="button"
              size="xs"
              disabled={max === 0}
              onClick={openDialog}
              className="shrink-0 gap-1 bg-success text-white hover:bg-success/90"
            >
              <IconGift className="size-3" />
              استبدال النقاط
            </Button>
          )}
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>
            {redeemed > 0 ? "" : (reason ?? `حتى ${max} نقطة في الفاتورة دي`)}
          </span>
          {totals.pointsToEarn > 0 && (
            <span className="text-success">
              هيكسب +<Num>{totals.pointsToEarn}</Num> نقطة
            </span>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="text-start">
            <DialogTitle>استبدال نقاط {customer.name}</DialogTitle>
            <DialogDescription>
              رصيده <Num>{balance}</Num> نقطة. كل <Num>{step}</Num> نقطة ={" "}
              <Money amount={cfg.redeemValue} className="inline-flex" /> خصم،
              وبحد أقصى <Num>{max}</Num> نقطة في الفاتورة دي.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="icon"
              aria-label="أقل"
              disabled={points <= step}
              onClick={() => setPoints((p) => Math.max(p - step, step))}
            >
              <IconMinus />
            </Button>
            <div className="text-center">
              <Num className="block text-2xl font-semibold">{points}</Num>
              <span className="text-xs text-muted-foreground">نقطة</span>
            </div>
            <Button
              variant="outline"
              size="icon"
              aria-label="أكثر"
              disabled={points + step > max}
              onClick={() => setPoints((p) => Math.min(p + step, max))}
            >
              <IconPlus />
            </Button>
          </div>
          <p className="text-center text-sm">
            خصم{" "}
            <Money
              amount={redeemDiscount(cfg, points)}
              className="inline-flex text-base text-success"
            />
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setPoints(max)}>
              كل المسموح
            </Button>
            <Button
              autoFocus
              onClick={() => {
                dispatch(cartActions.setRedeemPoints(points));
                setOpen(false);
              }}
            >
              تطبيق
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
