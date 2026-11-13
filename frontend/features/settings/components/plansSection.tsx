"use client";

import {
  IconBrandWhatsapp,
  IconCheck,
  IconChevronDown,
  IconCircleCheckFilled,
  IconCrown,
  IconLoader2,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePlan } from "@/lib/plan";
import { openWhatsapp } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

import {
  PLANS,
  SALES_WHATSAPP,
  formatPlanPrice,
  subscribeMessage,
  type Billing,
  type PlanCard,
} from "../config/plans";
import { useLicense, useShopName } from "../hooks/useSettings";

const BILLING_TABS = [
  { id: "monthly" as const, label: "شهري" },
  { id: "yearly" as const, label: "سنوي — شهرين مجاناً" },
];

const ORDER: PlanCard["id"][] = ["free", "basic", "pro", "enterprise"];

const PLANS_HASH = "#plans";

/** الخطط الأربع: مقارنة واضحة + اشتراك برسالة واتساب جاهزة فيها رقم الجهاز والمبلغ.
 *  مطوية افتراضياً حتى لا تطوّل صفحة الإعدادات، وتنفتح تلقائياً عند الوصول من «عرض الخطط». */
export function PlansSection() {
  const [billing, setBilling] = useState<Billing>("monthly");
  const [open, setOpen] = useState(true);
  const plan = usePlan().data;
  const current = plan?.plan ?? null;

  useEffect(() => {
    const sync = () => {
      if (window.location.hash === PLANS_HASH) setOpen(true);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {plan?.isFree
            ? "تحتاج إلى ميزات أكثر؟ قارن الخطط واشترك برسالة واتساب واحدة."
            : "للتجديد أو تغيير خطتك: قارن الخطط واطلب برسالة واتساب واحدة."}
        </p>
        <Button
          type="button"
          variant={open ? "ghost" : "outline"}
          size="sm"
          aria-expanded={open}
          aria-controls="plans-list"
          onClick={() => setOpen((v) => !v)}
          className="gap-1.5 font-normal"
        >
          {open ? "إخفاء الخطط" : "عرض الخطط ومقارنتها"}
          <IconChevronDown
            className={cn(
              "size-4 transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </Button>
      </div>

      {open && (
        <PlansList
          billing={billing}
          setBilling={setBilling}
          current={current}
        />
      )}
    </div>
  );
}

function PlansList({
  billing,
  setBilling,
  current,
}: {
  billing: Billing;
  setBilling: (b: Billing) => void;
  current: PlanCard["id"] | null;
}) {
  return (
    <div id="plans-list" className="space-y-4 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          اضغط «اشترك»: سيُفتح واتساب برسالة جاهزة تتضمن رقم جهازك والمبلغ، وبعد
          الدفع يصلك مفتاح الترخيص فتلصقه في خانة التفعيل بالأسفل.
        </p>
        <SegmentedTabs
          label="مدة الاشتراك"
          items={BILLING_TABS}
          value={billing}
          onChange={setBilling}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {PLANS.map((plan) => (
          <PlanCardView
            key={plan.id}
            plan={plan}
            billing={billing}
            onYearly={() => setBilling("yearly")}
            current={current === plan.id}
            below={
              current !== null &&
              ORDER.indexOf(plan.id) < ORDER.indexOf(current)
            }
          />
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground">
        الأسعار بالجنيه المصري. الترقية أو التجديد أو تغيير الخطة في أي وقت
        بمفتاح جديد، وبياناتك تبقى كما هي.
      </p>
    </div>
  );
}

function PlanCardView({
  plan,
  billing,
  onYearly,
  current,
  below,
}: {
  plan: PlanCard;
  billing: Billing;
  /** «وفّر شهرين» في الكارت: يحوّل كل الخطط للعرض السنوي. */
  onYearly: () => void;
  current: boolean;
  /** خطة أقل من الحالية. */
  below: boolean;
}) {
  const license = useLicense();
  const shop = useShopName();
  const [sending, setSending] = useState(false);

  const free = plan.monthly === null;
  const price = billing === "monthly" ? plan.monthly : plan.yearly;
  const machineId = license.data?.machine_id ?? null;

  async function subscribe() {
    if (!machineId) {
      toast.error("رقم الجهاز متاح في نسخة سطح المكتب فقط.");
      return;
    }
    setSending(true);
    try {
      await openWhatsapp(
        SALES_WHATSAPP,
        subscribeMessage({
          plan,
          billing,
          machineId,
          shopName: shop.data ?? null,
        }),
      );
    } catch {
      toast.error(
        "تعذّر فتح واتساب. تأكد أنه مثبت على الجهاز أو افتح wa.me من المتصفح.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <article
      className={cn(
        "relative flex flex-col gap-4 border bg-card p-5",
        plan.popular && "border-primary shadow-sm ring-1 ring-primary/40",
        current && "bg-primary/5",
      )}
    >
      {plan.popular && (
        <Badge className="absolute -top-2.5 inset-s-4 gap-1 font-normal">
          <IconCrown className="size-3.5" />
          الأكثر اختياراً
        </Badge>
      )}

      <header className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold">{plan.name}</h3>
          {current && (
            <span className="flex items-center gap-1 text-xs font-medium text-primary">
              <IconCircleCheckFilled className="size-4" />
              خطتك الحالية
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{plan.tagline}</p>
      </header>

      <div className="space-y-0.5">
        {free ? (
          <p className="text-3xl font-bold">مجاناً</p>
        ) : (
          <p className="flex flex-wrap items-baseline gap-1.5">
            {plan.startsFrom && (
              <span className="text-xs text-muted-foreground">يبدأ من</span>
            )}
            <span
              dir="ltr"
              className="font-mono text-3xl font-bold tabular-nums"
            >
              {price!.toLocaleString("en-US")}
            </span>
            <span className="text-sm text-muted-foreground">
              ج.م / {billing === "monthly" ? "شهر" : "سنة"}
            </span>
          </p>
        )}
        <p className="flex h-4 items-center gap-1 text-[11px] text-muted-foreground">
          {free ? (
            "أدر محلك مجاناً"
          ) : billing === "yearly" ? (
            `يعادل ${formatPlanPrice(Math.round(plan.yearly! / 12))} شهرياً`
          ) : (
            <>
              أو {formatPlanPrice(plan.yearly!)} سنوياً
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={onYearly}
                className="h-auto p-0 text-[11px] font-medium"
              >
                (وفّر شهرين)
              </Button>
            </>
          )}
        </p>
      </div>

      <ul className="flex-1 space-y-2 text-xs">
        {plan.includes && (
          <li className="flex items-start gap-2 font-semibold">
            <IconCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
            كل ما في خطة «{plan.includes}»، بالإضافة إلى:
          </li>
        )}
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <IconCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {free ? (
        <Button
          variant="outline"
          size="lg"
          disabled
          className="w-full font-normal"
        >
          {current ? "خطتك الحالية" : "متاحة دائماً مجاناً"}
        </Button>
      ) : (
        <Button
          size="lg"
          variant={plan.popular ? "default" : "outline"}
          disabled={sending}
          onClick={() => void subscribe()}
          className="w-full gap-2"
        >
          {sending ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconBrandWhatsapp className="size-4" />
          )}
          {current ? "تجديد الاشتراك" : below ? "التحويل لهذه الخطة" : "اشترك"}
        </Button>
      )}
    </article>
  );
}
