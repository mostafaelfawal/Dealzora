"use client";

import { IconAlertTriangle, IconLoader2 } from "@tabler/icons-react";
import { useRef, useState } from "react";
import type { FormEvent } from "react";

import { Money } from "@/components/shared/Money";
import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { formatMoneyText } from "@/lib/format";
import { round2 } from "@/features/pos/lib/posCalc";

import { useCollectPayment } from "../hooks/useCustomerMutations";
import { parseAmount } from "../lib/customerCalc";
import type { Customer } from "../types/customer";
import { CurrencyLabel } from "@/components/shared/CurrencyLabel";

/** تحصيل دفعة من عميل عليه دين: المبلغ معبّأ بالدين كاملاً، فالتحصيل الكامل ضغطة Enter واحدة. */
export function CollectPaymentDialog({
  customer,
  onClose,
}: {
  customer: Customer | null;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog
      open={customer !== null}
      onOpenChange={(next) => !next && onClose()}
    >
      <DialogContent
        showCloseButton={false}
        initialFocus={inputRef}
        className="gap-3 sm:max-w-sm"
      >
        {customer && (
          <CollectForm
            customer={customer}
            inputRef={inputRef}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CollectForm({
  customer,
  inputRef,
  onClose,
}: {
  customer: Customer;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onClose: () => void;
}) {
  const collect = useCollectPayment();
  const [text, setText] = useState(String(customer.balance));
  const [note, setNote] = useState("");

  const parsed = parseAmount(text);
  const amount = Number.isFinite(parsed) ? round2(parsed) : 0;
  const remaining = round2(customer.balance - amount);

  let error: string | null = null;
  if (customer.balance <= 0) error = "هذا العميل ليس عليه مديونية.";
  else if (!(amount > 0)) error = "اكتب مبلغاً أكبر من صفر.";
  else if (amount > customer.balance)
    error = `المبلغ أكبر من دينه (${formatMoneyText(customer.balance)}).`;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (error || collect.isPending) return;
    collect.mutate(
      { id: customer.id, payment: { amount, note: note.trim() } },
      { onSuccess: onClose },
    );
  }

  const quick = [
    { label: "الدين كاملاً", value: customer.balance },
    { label: "النصف", value: round2(customer.balance / 2) },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <DialogHeader className="text-start">
        <DialogTitle>تحصيل دفعة</DialogTitle>
        <DialogDescription>{customer.name}</DialogDescription>
      </DialogHeader>

      <div className="flex items-end justify-between">
        <span className="pb-1 text-sm text-muted-foreground">
          المديونية الحالية
        </span>
        <Money amount={customer.balance} className="text-3xl leading-none" />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="collect-amount"
          className="text-xs text-muted-foreground"
        >
          المبلغ المستلم
        </label>
        <InputGroup className="h-12">
          <InputGroupInput
            id="collect-amount"
            ref={inputRef}
            dir="ltr"
            inputMode="decimal"
            autoComplete="off"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            aria-invalid={error ? true : undefined}
            maxLength={12}
            className="h-full text-center font-mono text-xl tabular-nums md:text-xl"
          />
          <InputGroupAddon align="inline-end" className="ml-2">
            <InputGroupText>
              <CurrencyLabel />
            </InputGroupText>
          </InputGroupAddon>
        </InputGroup>
        <div className="flex flex-wrap gap-1.5">
          {quick.map((q) => (
            <Button
              key={q.label}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setText(String(q.value))}
              className="font-normal"
            >
              {q.label}
            </Button>
          ))}
        </div>
      </div>

      <Input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        aria-label="ملاحظة على الدفعة"
        placeholder="ملاحظة (اختياري): تحويل، شيك…"
        autoComplete="off"
        maxLength={80}
      />

      <Separator />

      <dl aria-live="polite" className="space-y-1 text-xs">
        <div className="flex items-end justify-between">
          <dt className="pb-0.5 text-sm font-medium">المتبقي عليه</dt>
          <dd>
            <Money
              amount={error ? customer.balance : Math.max(remaining, 0)}
              className="text-2xl leading-none"
            />
          </dd>
        </div>
      </dl>

      {error && (
        <p
          role="alert"
          className="flex items-center gap-2 text-xs text-destructive"
        >
          <IconAlertTriangle className="size-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={collect.isPending}
          onClick={onClose}
          className="gap-2 font-normal"
        >
          رجوع
          <ShortcutBadge className="rounded-none">Esc</ShortcutBadge>
        </Button>
        <Button
          type="submit"
          size="lg"
          disabled={error !== null || collect.isPending}
          className="gap-2 px-5"
        >
          {collect.isPending ? (
            <>
              <IconLoader2 className="size-4 animate-spin" aria-hidden />
              جارٍ التسجيل…
            </>
          ) : (
            <>
              تأكيد التحصيل
              <ShortcutBadge className="rounded-none border-primary-foreground/30 text-primary-foreground/80">
                Enter
              </ShortcutBadge>
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
