"use client";

import {
  IconAlertTriangle,
  IconArrowsExchange,
  IconCreditCard,
  IconLoader2,
  IconPrinter,
  IconWallet,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, RefObject } from "react";

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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { formatMoneyText, normalizeDigits } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { cn } from "cn";
import { round2, suggestCashAmounts } from "../lib/posCalc";
import { confirmPayment } from "../store/posActions";
import { posUiActions } from "../store/posUiSlice";
import { selectInvoiceCustomer, selectTotals } from "../store/selectors";
import type { PaymentMethod } from "../types/pos";
import { CurrencyLabel } from "@/components/shared/CurrencyLabel";
import { useEnabledMethods, type PaymentKind } from "@/lib/payments";
import { upgradeMessage, useFeature } from "@/lib/plan";
import {
  isWalletMethod,
  paymentLabel,
} from "@/features/sales/config/saleOptions";

interface MethodButton {
  id: PaymentMethod;
  label: string;
  key?: string;
}

const BUILTIN_METHODS: MethodButton[] = [
  { id: "cash", label: "كاش", key: "F1" },
  { id: "credit", label: "آجل", key: "F2" },
  { id: "mixed", label: "مختلط", key: "F3" },
];
/** اختصارات الطرق الإلكترونية بالترتيب (F6 لاختيار العميل، F9 لفتح الدفع). */
const ELECTRONIC_KEYS = ["F4", "F5", "F7", "F8"];
/** عرض أزرار الطرق الإلكترونية في شبكة من 6 أعمدة حسب عددها. */
const electronicSpan = (count: number) =>
  count === 1 ? "col-span-6" : count === 3 ? "col-span-2" : "col-span-3";

const KIND_ICON: Record<PaymentKind, typeof IconWallet> = {
  wallet: IconWallet,
  card: IconCreditCard,
  transfer: IconArrowsExchange,
};
const REF_MAX = 40;

const initialCashText = (method: PaymentMethod, total: number) =>
  method === "cash" ? String(total) : "";

/** الدفع: فتح (F9) ثم Enter. الكاش معبّأ بالإجمالي، فإذا لم يكن هناك باقٍ فالعملية خطوتان فقط. */
export function PosPaymentDialog() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.posUi.dialog === "payment");
  const cashInputRef = useRef<HTMLInputElement>(null);

  const close = () => dispatch(posUiActions.closeDialog());

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent
        showCloseButton={false}
        initialFocus={cashInputRef}
        className="gap-3 sm:max-w-md"
      >
        <DialogHeader className="text-start">
          <DialogTitle>الدفع</DialogTitle>
          <DialogDescription>
            راجع المبلغ ثم اضغط Enter للتأكيد.
          </DialogDescription>
        </DialogHeader>
        <PaymentForm cashInputRef={cashInputRef} onCancel={close} />
      </DialogContent>
    </Dialog>
  );
}

interface PaymentFormProps {
  cashInputRef: RefObject<HTMLInputElement | null>;
  onCancel: () => void;
}

function PaymentForm({ cashInputRef, onCancel }: PaymentFormProps) {
  const dispatch = useAppDispatch();
  const { total } = useAppSelector(selectTotals);
  const customer = useAppSelector(selectInvoiceCustomer);
  // الطريقة اللي اتفتحت بيها النافذة (أو اللي رجعنا بيها من اختيار العميل).
  const initialMethod = useAppSelector((s) => s.posUi.paymentMethod);
  const saving = useAppSelector((s) => s.posUi.saving);

  // حالة الفورم (الطريقة الحالية والمبلغ المكتوب) محلية عمداً.
  const [method, setMethod] = useState<PaymentMethod>(initialMethod);
  const [cashText, setCashText] = useState(() =>
    initialCashText(initialMethod, total),
  );
  const [paymentRef, setPaymentRef] = useState("");
  const [print, setPrint] = useState(true);
  const submitRef = useRef<HTMLButtonElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);
  const firstRender = useRef(true);

  // بعد تغيير الطريقة: نقل التركيز إلى خانة المبلغ (أو زر التأكيد في الآجل).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (method === "credit") submitRef.current?.focus();
    else if (isWalletMethod(method)) refInputRef.current?.focus();
    else {
      cashInputRef.current?.focus();
      cashInputRef.current?.select();
    }
  }, [method, cashInputRef]);

  function changeMethod(next: PaymentMethod) {
    setMethod(next);
    setCashText(initialCashText(next, total));
  }

  const customersAllowed = useFeature("customers");
  const walletsAllowed = useFeature("wallets");
  const enabled = useEnabledMethods();
  const electronic: MethodButton[] = walletsAllowed
    ? enabled.map((m, i) => ({
        id: m.id,
        label: m.name,
        key: ELECTRONIC_KEYS[i],
      }))
    : [];
  const methods = [...BUILTIN_METHODS, ...electronic];
  const wallet = isWalletMethod(method);
  const walletMethod = wallet
    ? enabled.find((m) => m.id === method)
    : undefined;
  const KindIcon = KIND_ICON[walletMethod?.kind ?? "wallet"];
  const typed = round2(Number(normalizeDigits(cashText)) || 0);
  const cash = method === "credit" || wallet ? 0 : typed;
  const applied = method === "cash" ? total : cash;
  const credit = method === "cash" || wallet ? 0 : round2(total - applied);
  const change = method === "cash" ? round2(Math.max(cash - total, 0)) : 0;
  const available = customer
    ? Math.max(customer.creditLimit - customer.balance, 0)
    : 0;

  let error: string | null = null;
  let needsCustomer = false;
  if (wallet) {
    if (!walletsAllowed) error = upgradeMessage("wallets");
    else if (!walletMethod)
      error = `${paymentLabel(method)} غير مفعّلة. يفعّلها المدير من الإعدادات ← طرق الدفع.`;
  } else if (method !== "cash" && !customersAllowed) {
    // بَسطة: البيع كاش فقط (السيرفر يرفض الآجل أيضاً).
    error = upgradeMessage("customers");
  } else if (method === "cash") {
    if (cash < total)
      error = `المبلغ ناقص ${formatMoneyText(round2(total - cash))}`;
  } else if (!customer) {
    needsCustomer = true;
    error = "اختر عميلاً أولاً للبيع الآجل.";
  } else if (method === "mixed" && !(cash > 0 && cash < total)) {
    error =
      "في الدفع المختلط يجب أن يكون المدفوع كاشاً أكبر من صفر وأقل من الإجمالي.";
  } else if (credit > available) {
    error =
      customer.creditLimit === 0
        ? `${customer.name} غير مسموح له بالبيع الآجل.`
        : `المبلغ الآجل ${formatMoneyText(credit)} أكبر من المتاح للعميل (${formatMoneyText(available)}).`;
  }

  function pickCustomer() {
    dispatch(posUiActions.pickCustomerFromPayment(method));
  }

  function confirm() {
    if (error || saving) return;
    void dispatch(
      confirmPayment({
        method,
        received: method === "cash" ? cash : applied,
        cash: wallet ? 0 : applied,
        credit,
        change,
        paymentRef: wallet ? paymentRef.trim() || undefined : undefined,
        print,
      }),
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    confirm();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    const next = methods.find((m) => m.key === event.key);
    if (next) {
      event.preventDefault();
      changeMethod(next.id);
    } else if (event.key === "F6") {
      event.preventDefault();
      pickCustomer();
    }
  }

  const quickAmounts = suggestCashAmounts(total);

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      className="space-y-3"
    >
      <div className="flex items-end justify-between">
        <span className="pb-1 text-sm text-muted-foreground">المطلوب</span>
        <Money amount={total} className="text-4xl leading-none" />
      </div>

      <div
        role="group"
        aria-label="طريقة الدفع"
        className="grid grid-cols-6 gap-2"
      >
        {methods.map((m) => (
          <Button
            key={m.id}
            type="button"
            size="lg"
            variant={method === m.id ? "default" : "outline"}
            aria-pressed={method === m.id}
            onClick={() => changeMethod(m.id)}
            className={cn(
              "gap-2 font-normal",
              isWalletMethod(m.id)
                ? electronicSpan(electronic.length)
                : "col-span-2",
            )}
          >
            <span className="truncate">{m.label}</span>
            {m.key && (
              <ShortcutBadge
                className={cn(
                  "rounded-none",
                  method === m.id &&
                    "border-primary-foreground/30 text-primary-foreground/80",
                )}
              >
                {m.key}
              </ShortcutBadge>
            )}
          </Button>
        ))}
      </div>

      {walletMethod && walletsAllowed && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 border bg-muted/40 p-3">
            <KindIcon className="size-6 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              {walletMethod.account ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    يحوّل العميل على {walletMethod.name}
                  </p>
                  <bdi
                    dir="ltr"
                    className="block truncate font-mono text-lg font-semibold select-all"
                  >
                    {walletMethod.account}
                  </bdi>
                </>
              ) : (
                <p className="text-sm">
                  {walletMethod.kind === "card"
                    ? `ادفع ${formatMoneyText(total)} على جهاز ${walletMethod.name}`
                    : `الدفع عبر ${walletMethod.name}`}
                </p>
              )}
            </div>
          </div>
          <label htmlFor="pos-ref" className="text-xs text-muted-foreground">
            رقم العملية أو رقم المحوِّل (اختياري)
          </label>
          <InputGroup className="h-11">
            <InputGroupInput
              id="pos-ref"
              ref={refInputRef}
              dir="ltr"
              autoComplete="off"
              value={paymentRef}
              onChange={(event) => setPaymentRef(event.target.value)}
              maxLength={REF_MAX}
              className="h-full text-center font-mono"
            />
          </InputGroup>
          <p className="text-[11px] text-muted-foreground">
            {walletMethod.kind === "card"
              ? "أكّد بعد طباعة إيصال الجهاز بنجاح. المبلغ لا يدخل الدرج."
              : "أكّد بعد وصول رسالة التحويل للمحل. المبلغ لا يدخل الدرج."}
          </p>
        </div>
      )}

      {method !== "credit" && !wallet && (
        <div className="space-y-2">
          <label htmlFor="pos-cash" className="text-xs text-muted-foreground">
            {method === "cash" ? "المبلغ المستلم" : "المدفوع كاش"}
          </label>
          <InputGroup className="h-12">
            <InputGroupInput
              id="pos-cash"
              ref={cashInputRef}
              dir="ltr"
              inputMode="decimal"
              autoComplete="off"
              value={cashText}
              onChange={(event) => setCashText(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              aria-invalid={
                method === "cash" && cash < total ? true : undefined
              }
              maxLength={12}
              className="h-full text-center font-mono text-xl tabular-nums md:text-xl"
            />
            <InputGroupAddon align="inline-end" className="ml-2">
              <InputGroupText>
                <CurrencyLabel />
              </InputGroupText>
            </InputGroupAddon>
          </InputGroup>

          {method === "cash" && (
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setCashText(String(total))}
                className="font-normal"
              >
                بالضبط
              </Button>
              {quickAmounts.map((amount) => (
                <Button
                  key={amount}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setCashText(String(amount))}
                  className="font-mono font-normal tabular-nums"
                >
                  {amount}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      <Separator />

      <dl aria-live="polite" className="space-y-1.5 text-xs">
        {method === "cash" && (
          <div className="flex items-end justify-between">
            <dt className="pb-0.5 text-sm font-medium">الباقي للعميل</dt>
            <dd>
              <Money
                amount={error ? 0 : change}
                className="text-3xl leading-none"
              />
            </dd>
          </div>
        )}
        {wallet && (
          <div className="flex items-end justify-between">
            <dt className="pb-0.5 text-sm font-medium">المطلوب تحويله</dt>
            <dd>
              <Money amount={total} className="text-3xl leading-none" />
            </dd>
          </div>
        )}
        {method !== "cash" && !wallet && (
          <>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">كاش</dt>
              <dd>
                <Money amount={applied} />
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">
                آجل على {customer ? customer.name : "العميل"}
              </dt>
              <dd>
                <Money amount={Math.max(credit, 0)} />
              </dd>
            </div>
            {customer && (
              <div className="flex items-center justify-between text-muted-foreground">
                <dt>دينه الحالي · المتاح</dt>
                <dd className="flex items-center gap-2">
                  <Money amount={customer.balance} />
                  <span aria-hidden>·</span>
                  <Money amount={available} />
                </dd>
              </div>
            )}
          </>
        )}
      </dl>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 text-xs text-destructive"
        >
          <IconAlertTriangle className="size-4 shrink-0" />
          <span className="flex-1">{error}</span>
          {needsCustomer && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={pickCustomer}
              className="gap-2 font-normal text-foreground"
            >
              اختيار عميل
              <ShortcutBadge className="rounded-none">F6</ShortcutBadge>
            </Button>
          )}
        </div>
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
          onClick={onCancel}
          className="h-11 gap-2 font-normal"
        >
          رجوع
          <ShortcutBadge className="rounded-none">Esc</ShortcutBadge>
        </Button>
        <Button
          ref={submitRef}
          type="submit"
          size="lg"
          disabled={error !== null || saving}
          className="h-11 gap-2 px-5 text-sm"
        >
          {saving && <IconLoader2 className="size-4 animate-spin" />}
          {saving ? "جارٍ الحفظ…" : "تأكيد وحفظ الفاتورة"}
          <ShortcutBadge className="rounded-none border-primary-foreground/30 text-primary-foreground/80">
            Enter
          </ShortcutBadge>
        </Button>
      </div>
    </form>
  );
}
