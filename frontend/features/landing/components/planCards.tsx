"use client";

import {
  IconBrandWhatsapp,
  IconCheck,
  IconCrown,
  IconDownload,
} from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PLAN_ICON } from "@/config/planBadges";
import {
  BILLING_LABEL,
  PLANS,
  SALES_WHATSAPP,
  formatPlanPrice,
  subscribeMessage,
  type Billing,
  type PlanCard,
  type PlanStats,
} from "@/features/settings/config/plans";
import { cn } from "@/lib/utils";

import { Reveal, Stagger, StaggerItem } from "./motion";
import { ctaClass, external } from "./primitives";

/**
 * كروت الخطط بنفس أسعار وميزات صفحة «الخطة والترخيص» في البرنامج (features/settings/config/plans.ts):
 * شهري أو سنوي (السنوي = 10 أشهر)، والاشتراك برسالة واتساب جاهزة بنفس صيغة البرنامج.
 */

const STAT_ROWS: { key: keyof PlanStats; label: string }[] = [
  { key: "devices", label: "الأجهزة" },
  { key: "users", label: "المستخدمون" },
  { key: "products", label: "الأصناف" },
  { key: "branches", label: "الفروع" },
];

/** ما يوفّره السنوي مقارنة بدفع 12 شهراً. */
const yearlySaving = (plan: PlanCard) =>
  plan.monthly !== null && plan.yearly !== null
    ? plan.monthly * 12 - plan.yearly
    : 0;

// أكبر توفير بين الخطط، لشارة زر «سنوي».
const MONTHS_FREE = (() => {
  const paid = PLANS.find((p) => p.monthly !== null && p.yearly !== null);
  return paid ? Math.round(yearlySaving(paid) / paid.monthly!) : 0;
})();

function BillingToggle({
  value,
  onChange,
}: {
  value: Billing;
  onChange: (b: Billing) => void;
}) {
  const items: Billing[] = ["monthly", "yearly"];
  return (
    <div
      role="radiogroup"
      aria-label="مدة الاشتراك"
      className="inline-flex items-center gap-1 border bg-background p-1"
    >
      {items.map((id) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(id)}
            className={cn(
              "flex h-10 items-center gap-2 px-5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-primary font-semibold text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {BILLING_LABEL[id]}
            {id === "yearly" && MONTHS_FREE > 0 && (
              <span
                className={cn(
                  "px-1.5 py-0.5 text-[11px] font-semibold",
                  active
                    ? "bg-primary-foreground/15"
                    : "bg-success/15 text-success",
                )}
              >
                {MONTHS_FREE === 2
                  ? "شهران مجاناً"
                  : `${MONTHS_FREE} أشهر مجاناً`}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Price({
  plan,
  billing,
  onYearly,
}: {
  plan: PlanCard;
  billing: Billing;
  onYearly: () => void;
}) {
  if (plan.monthly === null || plan.yearly === null)
    return (
      <div className="space-y-1">
        <p className="text-3xl font-bold">مجاناً</p>
        <p className="text-xs text-muted-foreground">بدون اشتراك وبدون مدة</p>
      </div>
    );

  const price = billing === "monthly" ? plan.monthly : plan.yearly;
  const saving = yearlySaving(plan);

  return (
    <div className="space-y-1">
      <p className="flex flex-wrap items-baseline gap-x-1.5">
        {plan.startsFrom && (
          <span className="text-xs text-muted-foreground">يبدأ من</span>
        )}
        <span dir="ltr" className="font-mono text-3xl font-bold tabular-nums">
          {price.toLocaleString("en-US")}
        </span>
        <span className="text-sm text-muted-foreground">
          ج.م / {billing === "monthly" ? "شهر" : "سنة"}
        </span>
      </p>
      <div className="min-h-10 space-y-1 text-xs text-muted-foreground">
        {billing === "yearly" ? (
          <>
            <p className="flex flex-wrap items-center gap-2">
              <span className="bg-success/15 px-1.5 py-0.5 font-semibold text-success">
                وفّر {formatPlanPrice(saving)}
              </span>
              <span className="line-through">
                {formatPlanPrice(plan.monthly * 12)}
              </span>
            </p>
            <p>يعادل {formatPlanPrice(Math.round(plan.yearly / 12))} شهرياً</p>
          </>
        ) : (
          <>
            <p>أو {formatPlanPrice(plan.yearly)} سنوياً</p>
            <button
              type="button"
              onClick={onYearly}
              className="font-semibold text-success underline-offset-2 outline-none hover:underline focus-visible:underline"
            >
              اشترك سنوياً ووفّر {formatPlanPrice(saving)}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function PlanColumn({
  plan,
  billing,
  onYearly,
  onSubscribe,
}: {
  plan: PlanCard;
  billing: Billing;
  onYearly: () => void;
  onSubscribe: () => void;
}) {
  const Icon = PLAN_ICON[plan.id];
  const free = plan.monthly === null;

  return (
    <StaggerItem
      as="article"
      variant="scale"
      aria-labelledby={`plan-${plan.id}`}
      className={cn(
        "relative flex flex-col bg-background",
        plan.popular && "outline-2 -outline-offset-2 outline-primary",
      )}
    >
      {plan.popular && (
        <p className="absolute top-0 left-0 flex items-center gap-1 bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
          <IconCrown className="size-3.5" aria-hidden />
          الأكثر اختياراً
        </p>
      )}
      <div className="space-y-5 border-b p-6">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-10 items-center justify-center",
              plan.popular ? "bg-primary text-primary-foreground" : "bg-muted",
            )}
          >
            <Icon className="size-5" aria-hidden />
          </span>
          <div>
            <h3 id={`plan-${plan.id}`} className="text-xl font-bold">
              {plan.name}
            </h3>
            <p className="text-sm text-muted-foreground">{plan.tagline}</p>
          </div>
        </div>

        <Price plan={plan} billing={billing} onYearly={onYearly} />

        {free ? (
          <Link href="/#download" className={cn(ctaClass("outline"), "w-full")}>
            <IconDownload aria-hidden />
            حمّل وابدأ مجاناً
          </Link>
        ) : (
          <button
            type="button"
            onClick={onSubscribe}
            className={cn(
              ctaClass(plan.popular ? "default" : "outline"),
              "w-full",
            )}
          >
            <IconBrandWhatsapp aria-hidden />
            اشترك في «{plan.name}»
          </button>
        )}
      </div>

      <dl className="grid grid-cols-2 border-b text-sm">
        {STAT_ROWS.map((r, i) => (
          <div
            key={r.key}
            className={cn(
              "space-y-0.5 p-4",
              i % 2 === 0 && "border-l",
              i < 2 && "border-b",
            )}
          >
            <dt className="text-xs text-muted-foreground">{r.label}</dt>
            <dd className="font-semibold">{plan.stats[r.key]}</dd>
          </div>
        ))}
      </dl>

      <div className="flex-1 space-y-3 p-6">
        {plan.includes && (
          <p className="text-sm font-semibold">
            كل ما في «{plan.includes}»، وأيضاً:
          </p>
        )}
        <ul className="space-y-2.5">
          {plan.features.map((f) => (
            <li key={f} className="flex gap-2.5 text-sm leading-6">
              <IconCheck
                className="mt-0.5 size-4 shrink-0 text-success"
                aria-hidden
              />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </StaggerItem>
  );
}

/** نافذة طلب الاشتراك: نفس رسالة البرنامج (subscribeMessage)، ورقم الجهاز اختياري لمن لم يثبّت بعد. */
function SubscribeDialog({
  plan,
  billing,
  onClose,
}: {
  plan: PlanCard | null;
  billing: Billing;
  onClose: () => void;
}) {
  const [shopName, setShopName] = useState("");
  const [machineId, setMachineId] = useState("");

  const price = plan
    ? billing === "monthly"
      ? plan.monthly
      : plan.yearly
    : null;
  const href = plan
    ? `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(
        subscribeMessage({
          plan,
          billing,
          machineId: machineId.trim() || "سأرسله بعد تثبيت البرنامج",
          shopName: shopName.trim() || null,
        }),
      )}`
    : "#";

  return (
    <Dialog open={plan !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        {plan && (
          <>
            <DialogHeader className="gap-1.5 text-start">
              <DialogTitle className="text-lg font-bold">
                طلب الاشتراك في «{plan.name}»
              </DialogTitle>
              <DialogDescription className="text-sm leading-7">
                سيُفتح واتساب برسالة جاهزة بالخطة والمبلغ. بعد تأكيد الدفع نرسل
                لك مفتاح الترخيص على المحادثة نفسها.
              </DialogDescription>
            </DialogHeader>

            <dl className="grid grid-cols-2 border text-sm">
              <div className="space-y-0.5 border-l p-3">
                <dt className="text-xs text-muted-foreground">نوع الاشتراك</dt>
                <dd className="font-semibold">{BILLING_LABEL[billing]}</dd>
              </div>
              <div className="space-y-0.5 p-3">
                <dt className="text-xs text-muted-foreground">المبلغ</dt>
                <dd className="font-semibold">
                  {plan.startsFrom && "يبدأ من "}
                  {price !== null && formatPlanPrice(price)}
                </dd>
              </div>
            </dl>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="sub-shop" className="text-sm">
                  اسم المحل{" "}
                  <span className="text-muted-foreground">(اختياري)</span>
                </Label>
                <Input
                  id="sub-shop"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  autoComplete="organization"
                  className="h-10 text-sm md:text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sub-machine" className="text-sm">
                  رقم الجهاز{" "}
                  <span className="text-muted-foreground">(اختياري)</span>
                </Label>
                <Input
                  id="sub-machine"
                  dir="ltr"
                  value={machineId}
                  onChange={(e) => setMachineId(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  className="h-10 font-mono text-sm md:text-sm"
                />
                <p className="text-xs leading-6 text-muted-foreground">
                  تجده في البرنامج: الإعدادات ← الخطة والترخيص. لم تثبّت البرنامج
                  بعد؟ اتركه فارغاً وأرسله لاحقاً.
                </p>
              </div>
            </div>

            <a
              href={href}
              {...external}
              onClick={onClose}
              className={cn(ctaClass("default", "lg"), "w-full")}
            >
              <IconBrandWhatsapp aria-hidden />
              إرسال الطلب على واتساب
            </a>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function PlanCards() {
  const [billing, setBilling] = useState<Billing>("monthly");
  const [subscribing, setSubscribing] = useState<PlanCard | null>(null);

  return (
    <div className="space-y-8">
      <Reveal variant="fade" className="flex justify-center">
        <BillingToggle value={billing} onChange={setBilling} />
      </Reveal>

      {/* الخطط تصعد بالتتابع من الأبسط إلى الأعلى. */}
      <Stagger
        stagger={0.12}
        amount={0.15}
        className="grid gap-px border bg-border md:grid-cols-2 xl:grid-cols-4"
      >
        {PLANS.map((plan) => (
          <PlanColumn
            key={plan.id}
            plan={plan}
            billing={billing}
            onYearly={() => setBilling("yearly")}
            onSubscribe={() => setSubscribing(plan)}
          />
        ))}
      </Stagger>

      <SubscribeDialog
        plan={subscribing}
        billing={billing}
        onClose={() => setSubscribing(null)}
      />
    </div>
  );
}
