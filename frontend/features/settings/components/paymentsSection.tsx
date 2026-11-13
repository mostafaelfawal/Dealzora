"use client";

import {
  IconArrowsExchange,
  IconCreditCard,
  IconDeviceFloppy,
  IconLoader2,
  IconPlus,
  IconTrash,
  IconWallet,
} from "@tabler/icons-react";
import { useState, type FormEvent, type ReactNode } from "react";

import { OptionSelect } from "@/components/shared/OptionSelect";
import { UpgradeNotice } from "@/components/shared/PlanGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCurrency } from "@/lib/currency";
import {
  PAYMENT_KIND_LABEL,
  PAYMENT_LIMITS,
  usePaymentConfig,
  type ElectronicMethod,
  type PaymentConfig,
  type PaymentKind,
} from "@/lib/payments";
import { useFeature } from "@/lib/plan";

import {
  countryForCurrency,
  customMethodId,
  PAYMENT_COUNTRIES,
  PAYMENT_TEMPLATES,
  type PaymentTemplate,
} from "../config/paymentTemplates";
import { useSavePaymentConfig } from "../hooks/useSettings";

const KIND_ICON: Record<PaymentKind, ReactNode> = {
  wallet: <IconWallet className="size-4" aria-hidden />,
  card: <IconCreditCard className="size-4" aria-hidden />,
  transfer: <IconArrowsExchange className="size-4" aria-hidden />,
};

const KIND_ITEMS = (Object.keys(PAYMENT_KIND_LABEL) as PaymentKind[]).map(
  (k) => ({ value: k, label: PAYMENT_KIND_LABEL[k] }),
);

const COUNTRY_ITEMS = PAYMENT_COUNTRIES.map((c) => ({
  value: c.iso,
  label: c.name,
}));

/** ما يُحفظ فعلاً: الطرق المعطّلة بلا حساب تُحذف (القالب يعيدها بضغطة). */
const normalize = (c: PaymentConfig): PaymentConfig => ({
  country: c.country,
  methods: c.methods
    .map((m) => ({
      ...m,
      name: m.name.trim(),
      account: m.account?.trim() || null,
    }))
    .filter((m) => m.enabled || m.account),
});

/** طرق الدفع الإلكتروني حسب الدولة. الطريقة تظهر في الكاشير فقط لو مفعّلة. */
export function PaymentsSection() {
  const allowed = useFeature("wallets");
  if (!allowed) return <UpgradeNotice feature="wallets" />;
  return <PaymentsForm />;
}

function PaymentsForm() {
  const saved = usePaymentConfig();
  const currency = useCurrency();
  const save = useSavePaymentConfig();
  const [draft, setDraft] = useState<PaymentConfig | null>(null);

  const config = draft ?? saved;
  const country =
    config.country ??
    countryForCurrency(currency.code) ??
    COUNTRY_ITEMS[0].value;
  const templates = PAYMENT_TEMPLATES[country] ?? [];
  const templateIds = new Set(templates.map((t) => t.id));
  const others = config.methods.filter((m) => !templateIds.has(m.id));

  const next = normalize({ ...config, country });
  const changed = JSON.stringify(next) !== JSON.stringify(normalize(saved));
  const names = next.methods.map((m) => m.name);
  const error = next.methods.some((m) => !m.name)
    ? "اكتب اسم كل طريقة دفع مضافة"
    : new Set(names).size !== names.length
      ? "يوجد طريقتا دفع بنفس الاسم"
      : next.methods.length > PAYMENT_LIMITS.methods
        ? `الحد الأقصى ${PAYMENT_LIMITS.methods} طريقة دفع`
        : null;

  const update = (fn: (methods: ElectronicMethod[]) => ElectronicMethod[]) =>
    setDraft({ country, methods: fn(config.methods) });
  const patch = (id: string, p: Partial<ElectronicMethod>) =>
    update((ms) => ms.map((m) => (m.id === id ? { ...m, ...p } : m)));

  function toggleTemplate(t: PaymentTemplate, on: boolean) {
    if (config.methods.some((m) => m.id === t.id)) patch(t.id, { enabled: on });
    else
      update((ms) => [
        ...ms,
        { id: t.id, name: t.name, kind: t.kind, account: null, enabled: on },
      ]);
  }

  function addCustom() {
    update((ms) => [
      ...ms,
      {
        id: customMethodId(),
        name: "",
        kind: "wallet",
        account: null,
        enabled: true,
      },
    ]);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!changed || error) return;
    save.mutate(next, { onSuccess: () => setDraft(null) });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>الدولة</Label>
        <OptionSelect
          label="دولة قوالب طرق الدفع"
          items={COUNTRY_ITEMS}
          value={country}
          onChange={(iso) => setDraft({ ...config, country: iso })}
          className="w-full sm:w-64"
        />
        <p className="text-xs text-muted-foreground">
          نعرض لك طرق الدفع الشائعة في دولتك. فعّل ما يستخدمه محلك فقط.
        </p>
      </div>

      <ul className="divide-y rounded-lg border">
        {templates.map((t) => {
          const m = config.methods.find((x) => x.id === t.id);
          const on = !!m?.enabled;
          return (
            <li key={t.id} className="space-y-2 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className="text-muted-foreground">
                    {KIND_ICON[t.kind]}
                  </span>
                  {t.name}
                  <span className="text-[11px] font-normal text-muted-foreground">
                    {PAYMENT_KIND_LABEL[t.kind]}
                  </span>
                </span>
                <Switch
                  checked={on}
                  onCheckedChange={(v) => toggleTemplate(t, v)}
                  aria-label={`تفعيل ${t.name}`}
                />
              </div>
              {on && t.accountHint && (
                <Input
                  dir="ltr"
                  value={m?.account ?? ""}
                  onChange={(e) => patch(t.id, { account: e.target.value })}
                  placeholder={t.accountHint}
                  maxLength={PAYMENT_LIMITS.account}
                  aria-label={`حساب ${t.name}`}
                  className="font-mono"
                />
              )}
            </li>
          );
        })}
        {templates.length === 0 && (
          <li className="p-3 text-sm text-muted-foreground">
            لا توجد قوالب لهذه الدولة. أضف طرقك يدوياً بالأسفل.
          </li>
        )}
      </ul>

      {others.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            طرق أخرى (يدوية أو من دولة أخرى)
          </p>
          <ul className="divide-y rounded-lg border">
            {others.map((m) => (
              <li key={m.id} className="space-y-2 p-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={m.name}
                    onChange={(e) => patch(m.id, { name: e.target.value })}
                    placeholder="اسم الطريقة (مثل: محفظة البنك)"
                    maxLength={PAYMENT_LIMITS.name}
                    aria-label="اسم طريقة الدفع"
                    className="flex-1"
                  />
                  <Switch
                    checked={m.enabled}
                    onCheckedChange={(v) => patch(m.id, { enabled: v })}
                    aria-label={`تفعيل ${m.name || "الطريقة"}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      update((ms) => ms.filter((x) => x.id !== m.id))
                    }
                    aria-label={`حذف ${m.name || "الطريقة"}`}
                  >
                    <IconTrash className="size-4" />
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <OptionSelect
                    label="نوع طريقة الدفع"
                    items={KIND_ITEMS}
                    value={m.kind}
                    onChange={(kind) => patch(m.id, { kind })}
                    className="w-full"
                  />
                  <Input
                    dir="ltr"
                    value={m.account ?? ""}
                    onChange={(e) => patch(m.id, { account: e.target.value })}
                    placeholder="رقم الحساب (اختياري)"
                    maxLength={PAYMENT_LIMITS.account}
                    aria-label={`حساب ${m.name || "الطريقة"}`}
                    className="font-mono"
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={addCustom}
        disabled={config.methods.length >= PAYMENT_LIMITS.methods}
        className="gap-2"
      >
        <IconPlus className="size-4" />
        إضافة طريقة أخرى
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <p
          className={
            error ? "text-xs text-destructive" : "text-xs text-muted-foreground"
          }
        >
          {error ?? "رقم الحساب يظهر للكاشير ليمليه على العميل."}
        </p>
        <Button
          type="submit"
          size="lg"
          disabled={!changed || !!error || save.isPending}
          className="h-10 gap-2"
        >
          {save.isPending ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconDeviceFloppy className="size-4" />
          )}
          حفظ طرق الدفع
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        المدفوع إلكترونياً لا يدخل درج الكاشير، فلا يُحسب في النقد المتوقع عند قفل
        الوردية. يظهر منفصلاً لكل طريقة في الوردية والتقارير لتطابقه مع رسائل
        التحويل وكشف الحساب.
      </p>
    </form>
  );
}
