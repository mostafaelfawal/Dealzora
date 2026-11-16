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

import {
  useCollectPayment,
  usePayoutBalance,
} from "../hooks/useCustomerMutations";
import { parseAmount } from "../lib/customerCalc";
import type { Customer } from "../types/customer";
import { CurrencyLabel } from "@/components/shared/CurrencyLabel";

/**
 * تحصيل دفعة من عميل عليه دين، أو (لو له رصيد لدى المحل) صرف رصيده نقداً من الخزنة.
 * المبلغ معبّأ بالرصيد كاملاً، فالعملية الكاملة ضغطة Enter واحدة.
 */
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
  // رصيد سالب = له لدى المحل: نفس النافذة بالعكس (صرف بدل تحصيل).
  const payout = customer.balance < 0;
  const owed = Math.abs(customer.balance);
  const collectMutation = useCollectPayment();
  const payoutMutation = usePayoutBalance();
  const collect = payout ? payoutMutation : collectMutation;
  const [text, setText] = useState(String(owed));
  const [note, setNote] = useState("");

  const parsed = parseAmount(text);
  const amount = Number.isFinite(parsed) ? round2(parsed) : 0;
  const remaining = round2(owed - amount);

  let error: string | null = null;
  if (owed <= 0) error = "هذا العميل ليس عليه مديونية ولا له رصيد.";
  else if (!(amount > 0)) error = "اكتب مبلغاً أكبر من صفر.";
  else if (amount > owed)
    error = payout
      ? `المبلغ أكبر من رصيده (${formatMoneyText(owed)}).`
      : `المبلغ أكبر من دينه (${formatMoneyText(owed)}).`;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (error || collect.isPending) return;
    collect.mutate(
      { id: customer.id, payment: { amount, note: note.trim() } },
      { onSuccess: onClose },
    );
  }

  const quick = [
    { label: payout ? "الرصيد كاملاً" : "الدين كاملاً", value: owed },
    { label: "النصف", value: round2(owed / 2) },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <DialogHeader className="text-start">
        <DialogTitle>{payout ? "صرف رصيد نقداً" : "تحصيل دفعة"}</DialogTitle>
        <DialogDescription>
          {customer.name}
          {payout && " · يخرج المبلغ من الخزنة ويُخصم من رصيده لدى المحل."}
        </DialogDescription>
      </DialogHeader>

      <div className="flex items-end justify-between">
        <span className="pb-1 text-sm text-muted-foreground">
          {payout ? "رصيده لدى المحل" : "المديونية الحالية"}
        </span>
        <Money amount={owed} className="text-3xl leading-none" />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="collect-amount"
          className="text-xs text-muted-foreground"
        >
          {payout ? "المبلغ المصروف" : "المبلغ المستلم"}
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
          <dt className="pb-0.5 text-sm font-medium">
            {payout ? "يتبقى له" : "المتبقي عليه"}
          </dt>
          <dd>
            <Money
              amount={error ? owed : Math.max(remaining, 0)}
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
              {payout ? "تأكيد الصرف" : "تأكيد التحصيل"}
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
