"use client";

import { IconAlertTriangle, IconLoader2 } from "@tabler/icons-react";
import { useRef, useState, type FormEvent } from "react";

import { CurrencyLabel } from "@/components/shared/CurrencyLabel";
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
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { round2 } from "@/features/pos/lib/posCalc";
import { formatMoneyText, moneyInputOrZero } from "@/lib/format";

import { usePayInstallment } from "../hooks/useInstallments";
import type { InstallmentPlan } from "../types/installment";

/**
 * تحصيل قسط: المبلغ معبّأ بالمستحق الآن (المتأخرات أو القسط القادم)، فالعملية ضغطة Enter.
 * الزيادة عن قسط واحد تُوزَّع على الأقساط التالية بالترتيب.
 */
export function PayInstallmentDialog({
  plan,
  onClose,
}: {
  plan: InstallmentPlan | null;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Dialog open={plan !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        initialFocus={inputRef}
        className="gap-3 sm:max-w-sm"
      >
        {plan && <PayForm plan={plan} inputRef={inputRef} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function PayForm({
  plan,
  inputRef,
  onClose,
}: {
  plan: InstallmentPlan;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onClose: () => void;
}) {
  const pay = usePayInstallment();
  const dueNow =
    plan.overdueAmount > 0
      ? plan.overdueAmount
      : Math.min(plan.nextDueAmount, plan.remaining);
  const [text, setText] = useState(String(dueNow));
  const [note, setNote] = useState("");

  const amount = round2(moneyInputOrZero(text));
  const after = round2(plan.remaining - amount);

  let error: string | null = null;
  if (!(amount > 0)) error = "اكتب مبلغاً أكبر من صفر.";
  else if (amount > plan.remaining)
    error = `المبلغ أكبر من المتبقي على الخطة (${formatMoneyText(plan.remaining)}).`;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (error || pay.isPending) return;
    pay.mutate({ id: plan.id, amount, note }, { onSuccess: onClose });
  }

  const quick = [
    plan.overdueAmount > 0 && {
      label: "المتأخرات",
      value: plan.overdueAmount,
    },
    plan.nextDueAmount > 0 && {
      label: "قسط واحد",
      value: Math.min(plan.nextDueAmount, plan.remaining),
    },
    { label: "سداد الخطة كاملة", value: plan.remaining },
  ].filter((q): q is { label: string; value: number } => Boolean(q));

  return (
    <form onSubmit={submit} className="space-y-3">
      <DialogHeader className="text-start">
        <DialogTitle>تحصيل قسط</DialogTitle>
        <DialogDescription>
          {plan.customerName} · {plan.title}
        </DialogDescription>
      </DialogHeader>

      <div className="flex items-end justify-between">
        <span className="pb-1 text-sm text-muted-foreground">
          {plan.overdueAmount > 0 ? "متأخرات مستحقة" : "القسط القادم"}
        </span>
        <Money
          amount={dueNow}
          className={
            plan.overdueAmount > 0
              ? "text-3xl leading-none text-destructive"
              : "text-3xl leading-none"
          }
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="pay-amount" className="text-xs text-muted-foreground">
          المبلغ المستلم
        </label>
        <InputGroup className="h-12">
          <InputGroupInput
            id="pay-amount"
            ref={inputRef}
            dir="ltr"
            inputMode="decimal"
            autoComplete="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
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
        onChange={(e) => setNote(e.target.value)}
        aria-label="ملاحظة على القسط"
        placeholder="ملاحظة (اختياري): تحويل، إيصال…"
        autoComplete="off"
        maxLength={80}
      />

      <Separator />

      <dl aria-live="polite" className="flex items-end justify-between">
        <dt className="pb-0.5 text-sm font-medium">المتبقي على الخطة</dt>
        <dd>
          <Money
            amount={error ? plan.remaining : Math.max(after, 0)}
            className="text-2xl leading-none"
          />
        </dd>
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
          disabled={pay.isPending}
          onClick={onClose}
          className="gap-2 font-normal"
        >
          رجوع
          <ShortcutBadge className="rounded-none">Esc</ShortcutBadge>
        </Button>
        <Button
          type="submit"
          size="lg"
          disabled={error !== null || pay.isPending}
          className="gap-2 px-5"
        >
          {pay.isPending ? (
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
