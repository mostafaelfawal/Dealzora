"use client";

import { IconDeviceFloppy, IconLoader2 } from "@tabler/icons-react";
import { useState, type FormEvent } from "react";

import { UpgradeNotice } from "@/components/shared/PlanGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeDigits } from "@/lib/format";
import { usePaymentAccounts } from "@/lib/payments";
import { useFeature } from "@/lib/plan";

import { useSavePaymentAccounts } from "../hooks/useSettings";

const INSTAPAY_MAX = 60;

/** رقم محفظة مصري: 11 رقماً يبدأ بـ 01 (نفس تحقق الـ backend). */
const cleanPhone = (value: string) =>
  normalizeDigits(value).replace(/[\s-]/g, "");
const isValidWallet = (value: string) => /^01\d{9}$/.test(value);

/** رقم فودافون كاش وعنوان إنستاباي للمحل. الطريقة تظهر في الكاشير فقط لو حسابها مسجّل. */
export function PaymentsSection() {
  const allowed = useFeature("wallets");
  if (!allowed) return <UpgradeNotice feature="wallets" />;
  return <PaymentsForm />;
}

function PaymentsForm() {
  const saved = usePaymentAccounts();
  const save = useSavePaymentAccounts();
  const [vodafone, setVodafone] = useState<string | null>(null);
  const [instapay, setInstapay] = useState<string | null>(null);

  const vfText = vodafone ?? saved.vodafoneCash ?? "";
  const ipText = instapay ?? saved.instapay ?? "";
  const vfClean = cleanPhone(vfText);
  const vfError =
    vfClean && !isValidWallet(vfClean)
      ? "الرقم يجب أن يكون 11 رقماً ويبدأ بـ 01"
      : null;

  const next = {
    vodafoneCash: vfClean || null,
    instapay: ipText.trim() || null,
  };
  const changed =
    next.vodafoneCash !== saved.vodafoneCash ||
    next.instapay !== saved.instapay;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!changed || vfError) return;
    save.mutate(next, {
      onSuccess: () => {
        setVodafone(null);
        setInstapay(null);
      },
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pay-vodafone">رقم فودافون كاش</Label>
          <Input
            id="pay-vodafone"
            dir="ltr"
            inputMode="tel"
            value={vfText}
            onChange={(e) => setVodafone(e.target.value)}
            placeholder="010xxxxxxxx"
            maxLength={16}
            aria-invalid={vfError ? true : undefined}
            className="font-mono"
          />
          {vfError && <p className="text-xs text-destructive">{vfError}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pay-instapay">عنوان إنستاباي</Label>
          <Input
            id="pay-instapay"
            dir="ltr"
            value={ipText}
            onChange={(e) => setInstapay(e.target.value)}
            placeholder="shop@instapay أو رقم الموبايل"
            maxLength={INSTAPAY_MAX}
            className="font-mono"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <p className="text-xs text-muted-foreground">
          اترك الخانة فارغة لإيقاف الطريقة في الكاشير.
        </p>
        <Button
          type="submit"
          size="lg"
          disabled={!changed || !!vfError || save.isPending}
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
        المدفوع بالمحفظة لا يدخل درج الكاشير، فلا يُحسب في الكاش المتوقع عند قفل
        الوردية. يظهر منفصلاً في الوردية والتقارير لتطابقه مع رسائل التحويل.
      </p>
    </form>
  );
}
