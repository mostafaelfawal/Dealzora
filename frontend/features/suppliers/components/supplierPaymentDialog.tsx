"use client";

import { IconLoader2 } from "@tabler/icons-react";
import { useState } from "react";

import { Money } from "@/components/shared/Money";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { MAX_NOTE_LEN } from "../config/supplierLimits";
import useCreateSupplierPayment from "../hooks/useCreateSupplierPayment";
import { paymentAmountError } from "../schema/supplier.schema";
import type { Supplier } from "../types/supplier";

/** تسجيل دفعة سداد لمورد. تُركَّب عند الفتح فقط ليبدأ كل سداد بحقول فارغة. */
export function SupplierPaymentDialog({
  supplier,
  onClose,
}: {
  supplier: Supplier | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={supplier !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent showCloseButton={false} className="gap-3 sm:max-w-md">
        {supplier && <PaymentForm supplier={supplier} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function PaymentForm({
  supplier,
  onClose,
}: {
  supplier: Supplier;
  onClose: () => void;
}) {
  const mutation = useCreateSupplierPayment();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  const error = touched ? paymentAmountError(amount) : null;
  const saving = mutation.isPending;

  async function submit() {
    setTouched(true);
    if (saving || paymentAmountError(amount)) return;
    try {
      await mutation.mutateAsync({
        supplierId: supplier.id,
        supplierName: supplier.name,
        amount,
        note,
      });
      onClose();
    } catch {
      // تم عرض الخطأ في onError.
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-3"
    >
      <DialogHeader className="text-start">
        <DialogTitle>تسجيل دفعة</DialogTitle>
        <DialogDescription>{supplier.name}</DialogDescription>
      </DialogHeader>

      <div className="flex items-center justify-between border bg-muted/30 p-2.5 text-xs">
        <span className="text-muted-foreground">المستحق له حالياً</span>
        <Money amount={supplier.balance} className="text-sm font-semibold" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sp-amount">المبلغ المدفوع *</Label>
        <div className="flex gap-2">
          <Input
            id="sp-amount"
            dir="ltr"
            inputMode="decimal"
            autoFocus
            autoComplete="off"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby="sp-amount-error"
            placeholder="0"
            className="font-mono"
          />
          {supplier.balance > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setAmount(String(supplier.balance))}
              className="shrink-0 font-normal"
            >
              سداد الكل
            </Button>
          )}
        </div>
        {error && (
          <p
            id="sp-amount-error"
            role="alert"
            className="text-xs text-destructive"
          >
            {error}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sp-note">ملاحظة</Label>
        <Input
          id="sp-note"
          value={note}
          maxLength={MAX_NOTE_LEN}
          onChange={(event) => setNote(event.target.value)}
          autoComplete="off"
          placeholder="مثال: دفعة تحت الحساب"
        />
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={saving}
          onClick={onClose}
          className="font-normal"
        >
          إلغاء
        </Button>
        <Button
          type="submit"
          size="lg"
          disabled={saving}
          className="gap-2 px-5"
        >
          {saving ? (
            <>
              <IconLoader2 className="size-4 animate-spin" aria-hidden />
              جارٍ الحفظ…
            </>
          ) : (
            "تسجيل الدفعة"
          )}
        </Button>
      </div>
    </form>
  );
}
