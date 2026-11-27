"use client";

import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconUser,
} from "@tabler/icons-react";
import { useRef, useState, type FormEvent } from "react";

import { Money } from "@/components/shared/Money";
import { UpgradeNotice } from "@/components/shared/PlanGate";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PICKUP_PRESETS } from "@/features/reservations/config/reservationOptions";
import { addDays, toIsoDay, todayIso } from "@/lib/dates";
import {
  formatItemCount,
  formatMoneyText,
  parseNumberInput,
} from "@/lib/format";
import { useFeature } from "@/lib/plan";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { cn } from "@/lib/utils";

import { POS_SHORTCUTS } from "../config/posShortcuts";
import { round2 } from "../lib/posCalc";
import { reserveCurrentInvoice } from "../store/posActions";
import { posUiActions } from "../store/posUiSlice";
import { selectInvoiceCustomer, selectTotals } from "../store/selectors";

const MAX_NOTE = 200;

/** الحقول تُبنى عند فتح النافذة فقط، فتبدأ فارغة في كل حجز. */
function ReserveForm() {
  const dispatch = useAppDispatch();
  const customer = useAppSelector(selectInvoiceCustomer);
  const { total, itemCount } = useAppSelector(selectTotals);
  const [pickupOn, setPickupOn] = useState<string>(() =>
    toIsoDay(addDays(new Date(), 1)),
  );
  const [depositText, setDepositText] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const depositRef = useRef<HTMLInputElement>(null);

  const parsed = depositText.trim() === "" ? 0 : parseNumberInput(depositText);
  const deposit = Number.isFinite(parsed) ? round2(parsed) : NaN;
  const debt = customer && customer.balance > 0 ? customer.balance : 0;
  const error = !customer
    ? null
    : Number.isNaN(deposit) || deposit < 0
      ? "اكتب مبلغ العربون بالأرقام"
      : deposit > total
        ? "العربون أكبر من إجمالي الفاتورة"
        : deposit > 0 && debt > 0
          ? `على العميل دين ${formatMoneyText(debt)}: حصّله أولاً أو احجز بلا عربون`
          : pickupOn && pickupOn < todayIso()
            ? "موعد الاستلام لا يكون في الماضي"
            : null;
  const canSave = Boolean(customer) && !error && !saving;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    const ok = await dispatch(
      reserveCurrentInvoice({
        pickupOn: pickupOn || null,
        deposit,
        note: note.trim() || null,
      }),
    );
    setSaving(false);
    if (ok) dispatch(posUiActions.closeDialog());
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* العميل: الحجز على اسمه، والعربون يُحفظ رصيداً على حسابه. */}
      <div className="flex items-center gap-3 border bg-muted/40 p-3">
        <IconUser className="size-5 shrink-0 text-muted-foreground" />
        {customer ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {customer.name}
            </span>
            {customer.phone && (
              <bdi
                dir="ltr"
                className="font-mono text-xs text-muted-foreground"
              >
                {customer.phone}
              </bdi>
            )}
          </span>
        ) : (
          <span className="flex-1 text-sm text-muted-foreground">
            الحجز يحتاج عميلاً لمتابعته والتواصل معه
          </span>
        )}
        <Button
          type="button"
          variant={customer ? "ghost" : "default"}
          size="sm"
          onClick={() => dispatch(posUiActions.pickCustomerFromReserve())}
          className="gap-2"
        >
          {customer ? "تغيير" : "اختيار العميل"}
          <ShortcutBadge className="hidden rounded-none sm:inline-flex">
            {POS_SHORTCUTS.customer.label}
          </ShortcutBadge>
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reserve-pickup">موعد الاستلام</Label>
        <div className="flex flex-wrap gap-1.5">
          {PICKUP_PRESETS.map((p) => {
            const day = toIsoDay(addDays(new Date(), p.days));
            return (
              <Button
                key={p.days}
                type="button"
                size="sm"
                variant={pickupOn === day ? "default" : "outline"}
                onClick={() => setPickupOn(day)}
                className="font-normal"
              >
                {p.label}
              </Button>
            );
          })}
          <Button
            type="button"
            size="sm"
            variant={pickupOn === "" ? "default" : "outline"}
            onClick={() => setPickupOn("")}
            className="font-normal"
          >
            بلا موعد
          </Button>
        </div>
        <Input
          id="reserve-pickup"
          type="date"
          dir="ltr"
          min={todayIso()}
          value={pickupOn}
          onChange={(e) => setPickupOn(e.target.value)}
          className="h-10 font-mono"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reserve-deposit">العربون (اختياري)</Label>
        <Input
          id="reserve-deposit"
          ref={depositRef}
          dir="ltr"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={depositText}
          onChange={(e) => setDepositText(e.target.value)}
          aria-invalid={error && depositText ? true : undefined}
          className="h-11 text-center font-mono text-lg tabular-nums"
        />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          يدخل درج الوردية الآن، ويُحفظ رصيداً للعميل يُخصم من الفاتورة عند
          الاستلام. لو أُلغي الحجز يبقى رصيداً له.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reserve-note">ملاحظة</Label>
        <Textarea
          id="reserve-note"
          rows={2}
          maxLength={MAX_NOTE}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="مثال: المقاس، اللون، أو موعد الاتصال"
        />
      </div>

      <dl className="space-y-1 border-t pt-3 text-xs">
        <div className="flex items-center justify-between text-muted-foreground">
          <dt>{formatItemCount(itemCount)}</dt>
          <dd>
            <Money amount={total} />
          </dd>
        </div>
        <div className="flex items-end justify-between">
          <dt className="pb-0.5 text-sm font-medium">الباقي عند الاستلام</dt>
          <dd>
            <Money
              amount={round2(total - (Number.isNaN(deposit) ? 0 : deposit))}
              className="text-2xl leading-none"
            />
          </dd>
        </div>
        <p className="text-[11px] text-muted-foreground">
          الأسعار تُراجع عند الاستلام، ولا يُخصم المخزون إلا مع البيع.
        </p>
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
          onClick={() => dispatch(posUiActions.closeDialog())}
        >
          رجوع
        </Button>
        <Button
          type="submit"
          size="lg"
          disabled={!canSave}
          className={cn("gap-2", saving && "opacity-70")}
        >
          <IconCalendarEvent className="size-4" />
          {saving ? "جارٍ الحفظ…" : "حفظ الحجز"}
        </Button>
      </div>
    </form>
  );
}

export function PosReserveDialog() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.posUi.dialog === "reserve");
  const allowed = useFeature("customers");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && dispatch(posUiActions.closeDialog())}
    >
      <DialogContent showCloseButton={false} className="gap-3 sm:max-w-md">
        <DialogHeader className="text-start">
          <DialogTitle>حجز الفاتورة لعميل</DialogTitle>
          <DialogDescription>
            تُحفظ الأصناف باسم العميل، وعند حضوره تختار الحجز من «الحجوزات» (
            {POS_SHORTCUTS.reservations.label}) لإتمام البيع.
          </DialogDescription>
        </DialogHeader>
        {allowed ? (
          open && <ReserveForm />
        ) : (
          <UpgradeNotice feature="customers" className="border-0 p-2" />
        )}
      </DialogContent>
    </Dialog>
  );
}
