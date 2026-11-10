"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { IconLoader2, IconPrinter } from "@tabler/icons-react";

import { Money } from "@/components/shared/Money";
import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { cn } from "cn";
import { confirmExchange } from "../store/posActions";
import { posUiActions } from "../store/posUiSlice";
import { selectExchange, selectSettlement } from "../store/selectors";

const COPY = {
  collect: { label: "المطلوب من العميل", confirm: "تأكيد واستلام الفرق" },
  refund: { label: "يُرد للعميل من الدرج", confirm: "تأكيد وصرف المبلغ" },
  even: { label: "لا فرق مالي", confirm: "تأكيد الاستبدال" },
} as const;

/** الخطوة الأخيرة: تسوية الفرق فقط (لا يدفع العميل مرتين). */
export function PosExchangeDialog() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.posUi.dialog === "exchange");
  const exchange = useAppSelector(selectExchange);
  const submitRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      open={open && exchange !== null}
      onOpenChange={(next) => !next && dispatch(posUiActions.closeDialog())}
    >
      <DialogContent
        showCloseButton={false}
        initialFocus={submitRef}
        className="gap-3 sm:max-w-md"
      >
        <DialogHeader className="text-start">
          <DialogTitle>
            تسوية الاستبدال
            {exchange ? ` · فاتورة #${exchange.invoiceNumber}` : ""}
          </DialogTitle>
          <DialogDescription>
            يُسجَّل المرتجع والبيع الجديد معاً، ويتحرك الفرق فقط في الدرج.
          </DialogDescription>
        </DialogHeader>
        <ExchangeForm submitRef={submitRef} />
      </DialogContent>
    </Dialog>
  );
}

function ExchangeForm({
  submitRef,
}: {
  submitRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const dispatch = useAppDispatch();
  const { newTotal, returnTotal, net, kind } = useAppSelector(selectSettlement);
  const saving = useAppSelector((s) => s.posUi.saving);
  const [print, setPrint] = useState(true);
  const copy = COPY[kind];

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void dispatch(confirmExchange(print));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <dl className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between text-muted-foreground">
          <dt>قيمة الأصناف الجديدة</dt>
          <dd>
            <Money amount={newTotal} />
          </dd>
        </div>
        <div className="flex items-center justify-between text-muted-foreground">
          <dt>قيمة المرتجع</dt>
          <dd className="flex items-baseline gap-1">
            <span aria-hidden>−</span>
            <Money amount={returnTotal} />
          </dd>
        </div>
      </dl>

      <Separator />

      <div aria-live="polite" className="flex items-end justify-between gap-3">
        <span className="pb-1 text-sm font-medium">{copy.label}</span>
        <Money
          amount={Math.abs(net)}
          className={cn(
            "text-4xl leading-none",
            kind === "refund" && "text-destructive",
          )}
        />
      </div>

      {kind === "refund" && (
        <p className="text-[11px] text-muted-foreground">
          يخرج المبلغ من درج الوردية الحالية.
        </p>
      )}

      <label className="flex items-center gap-2 text-xs">
        <Checkbox
          checked={print}
          onCheckedChange={(value) => setPrint(Boolean(value))}
        />
        طباعة الإيصال
        <IconPrinter className="size-5" />
      </label>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => dispatch(posUiActions.closeDialog())}
          className="h-11 gap-2 font-normal"
        >
          رجوع
          <ShortcutBadge className="rounded-none">Esc</ShortcutBadge>
        </Button>
        <Button
          ref={submitRef}
          type="submit"
          size="lg"
          disabled={saving}
          className="h-11 gap-2 px-5 text-sm"
        >
          {saving && <IconLoader2 className="size-4 animate-spin" />}
          {copy.confirm}
          <ShortcutBadge className="rounded-none border-primary-foreground/30 text-primary-foreground/80">
            Enter
          </ShortcutBadge>
        </Button>
      </div>
    </form>
  );
}
