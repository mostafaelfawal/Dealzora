"use client";

import {
  IconBrandWhatsapp,
  IconCash,
  IconCheck,
  IconChevronDown,
  IconCircleCheckFilled,
  IconClock,
  IconCrown,
  IconDatabase,
  IconDevices,
  IconHeadset,
  IconKey,
  IconLoader2,
  IconMapPin,
  IconPackage,
  IconRefresh,
  IconUsers,
  type Icon,
} from "@tabler/icons-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PLAN_ICON } from "@/config/planBadges";
import { usePlan } from "@/lib/plan";
import { openWhatsapp } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

import {
  PAYMENT_METHODS,
  PLANS,
  SALES_WHATSAPP,
  formatPlanPrice,
  subscribeMessage,
  type Billing,
  type PlanCard,
  type PlanStats,
} from "../config/plans";
import { useLicense, useShopName } from "../hooks/useSettings";

const ORDER: PlanCard["id"][] = ["free", "basic", "pro", "enterprise"];

const PLANS_HASH = "#plans";

/** كم ميزة تظهر في الكارت قبل «عرض كل الميزات». */
const VISIBLE_FEATURES = 5;

const STAT_ROWS: { key: keyof PlanStats; label: string; icon: Icon }[] = [
  { key: "devices", label: "الأجهزة", icon: IconDevices },
  { key: "users", label: "المستخدمون", icon: IconUsers },
  { key: "products", label: "الأصناف", icon: IconPackage },
  { key: "branches", label: "الفروع", icon: IconMapPin },
];

/** الخطط الأربع: مقارنة واضحة + اشتراك برسالة واتساب جاهزة فيها رقم الجهاز والمبلغ.
 *  قابلة للطي حتى لا تطوّل صفحة الإعدادات، وتنفتح تلقائياً عند الوصول من «عرض الخطط». */
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold">
            {plan?.isFree ? "طوّر محلك بخطة أكبر" : "خطتك واشتراكك"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {plan?.isFree
              ? "قارن الخطط واشترك برسالة واتساب واحدة، بدون أي تعقيد."
              : "للتجديد أو تغيير خطتك: اختر الخطة واطلبها برسالة واتساب واحدة."}
          </p>
        </div>
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
    <div id="plans-list" className="space-y-5">
      <div className="flex justify-center">
        <BillingToggle value={billing} onChange={setBilling} />
      </div>

      <div className="grid gap-4 pt-2 sm:grid-cols-2 xl:grid-cols-4">
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

      <HowToSubscribe />

      <ul className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-[11px] text-muted-foreground">
        <Assurance icon={IconDatabase}>
          بياناتك تبقى كما هي عند أي تغيير
        </Assurance>
        <Assurance icon={IconRefresh}>ترقية أو تغيير الخطة في أي وقت</Assurance>
        <Assurance icon={IconHeadset}>دعم فني على واتساب</Assurance>
        <Assurance icon={IconCash}>
          الدفع: {PAYMENT_METHODS.join(" · ")}
        </Assurance>
      </ul>
    </div>
  );
}

function BillingToggle({
  value,
  onChange,
}: {
  value: Billing;
  onChange: (b: Billing) => void;
}) {
  const items: { id: Billing; label: string }[] = [
    { id: "monthly", label: "شهري" },
    { id: "yearly", label: "سنوي" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="مدة الاشتراك"
      className="inline-flex items-center gap-1 border bg-muted/50 p-1"
    >
      {items.map((item) => {
        const active = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(item.id)}
            className={cn(
              "flex h-8 items-center gap-2 px-4 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              active
                ? "bg-background font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            {item.id === "yearly" && (
              <span className="bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                شهرين مجاناً
              </span>
            )}
          </button>
        );
      })}
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
  const [expanded, setExpanded] = useState(false);

  const free = plan.monthly === null;
  const price = billing === "monthly" ? plan.monthly : plan.yearly;
  const machineId = license.data?.machine_id ?? null;
  const PlanIcon = PLAN_ICON[plan.id];
  const highlighted = plan.popular && !current;

  const features = expanded
    ? plan.features
    : plan.features.slice(0, VISIBLE_FEATURES);
  const hidden =
    plan.features.length - VISIBLE_FEATURES + (plan.soon?.length ?? 0);

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
      aria-label={`خطة ${plan.name}`}
      className={cn(
        "relative flex flex-col border bg-card transition-shadow hover:shadow-md",
        highlighted && "border-primary shadow-md ring-1 ring-primary/40",
        current && "border-primary/60 bg-primary/5",
        below && "opacity-80",
      )}
    >
      {(highlighted || current) && (
        <span
          className={cn(
            "absolute -top-3 inset-s-4 flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium",
            current
              ? "border border-primary/60 bg-background text-primary"
              : "bg-primary text-primary-foreground",
          )}
        >
          {current ? (
            <>
              <IconCircleCheckFilled className="size-3.5" />
              خطتك الحالية
            </>
          ) : (
            <>
              <IconCrown className="size-3.5" />
              الأكثر اختياراً
            </>
          )}
        </span>
      )}

      {/* الرأس: الاسم + لمن تناسب */}
      <header className="flex items-start gap-3 p-5 pb-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center",
            highlighted || current
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground",
          )}
        >
          <PlanIcon className="size-5" />
        </span>
        <div className="min-w-0 space-y-0.5">
          <h4 className="text-lg leading-tight font-bold">{plan.name}</h4>
          <p className="text-xs text-muted-foreground">{plan.tagline}</p>
        </div>
      </header>

      {/* السعر */}
      <div className="space-y-1 px-5">
        {free ? (
          <p className="text-3xl font-bold">مجاناً</p>
        ) : (
          <p className="flex flex-wrap items-baseline gap-x-1.5">
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
        <p className="min-h-4 text-[11px] text-muted-foreground">
          {free ? (
            "بدون اشتراك وبدون مدة"
          ) : billing === "yearly" ? (
            <>
              <span className="line-through">
                {formatPlanPrice(plan.monthly! * 12)}
              </span>{" "}
              <span className="font-medium text-success">
                يعادل {formatPlanPrice(Math.round(plan.yearly! / 12))} شهرياً
              </span>
            </>
          ) : (
            <>
              أو {formatPlanPrice(plan.yearly!)} سنوياً{" "}
              <button
                type="button"
                onClick={onYearly}
                className="font-medium text-success underline-offset-2 hover:underline"
              >
                وفّر {formatPlanPrice(plan.monthly! * 2)}
              </button>
            </>
          )}
        </p>
      </div>

      {/* زر الإجراء أعلى الكارت: لا يحتاج التاجر للنزول حتى يشترك */}
      <div className="px-5 pt-4">
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
            variant={highlighted || current ? "default" : "outline"}
            disabled={sending}
            onClick={() => void subscribe()}
            className="w-full gap-2"
          >
            {sending ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : (
              <IconBrandWhatsapp className="size-4" />
            )}
            {current
              ? "تجديد الاشتراك"
              : below
                ? "التحويل لهذه الخطة"
                : `اشترك في «${plan.name}»`}
          </Button>
        )}
      </div>

      {/* المقارنة السريعة: نفس الصفوف في كل الكروت */}
      <dl className="mx-5 mt-4 grid grid-cols-2 border-y text-xs">
        {STAT_ROWS.map(({ key, label, icon: StatIcon }, i) => (
          <div
            key={key}
            className={cn(
              "flex flex-col gap-0.5 py-2.5",
              i % 2 === 0 ? "pe-2" : "border-s ps-3",
              i < 2 && "border-b",
            )}
          >
            <dt className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <StatIcon className="size-3.5" />
              {label}
            </dt>
            <dd className="font-semibold">{plan.stats[key]}</dd>
          </div>
        ))}
      </dl>

      {/* الميزات */}
      <div className="flex flex-1 flex-col p-5 pt-4">
        <ul className="flex-1 space-y-2 text-xs">
          {plan.includes && (
            <li className="flex items-start gap-2 font-semibold">
              <IconCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
              كل ما في «{plan.includes}»، بالإضافة إلى:
            </li>
          )}
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <IconCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
              <span>{f}</span>
            </li>
          ))}
          {expanded &&
            plan.soon?.map((f) => (
              <li
                key={f}
                className="flex items-start gap-2 text-muted-foreground"
              >
                <IconClock className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  {f}{" "}
                  <span className="border px-1 text-[10px] font-medium">
                    قريباً
                  </span>
                </span>
              </li>
            ))}
        </ul>

        {hidden > 0 && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 flex items-center gap-1 self-start text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            {expanded ? "عرض أقل" : `عرض كل الميزات (+${hidden})`}
            <IconChevronDown
              className={cn(
                "size-3.5 transition-transform",
                expanded && "rotate-180",
              )}
            />
          </button>
        )}
      </div>
    </article>
  );
}

const STEPS: { icon: Icon; title: string; text: string; payment?: boolean }[] =
  [
    {
      icon: IconBrandWhatsapp,
      title: "اضغط «اشترك»",
      text: "يُفتح واتساب برسالة جاهزة فيها الخطة والمبلغ ورقم جهازك.",
    },
    {
      icon: IconCash,
      title: "ادفع بالطريقة المناسبة لك",
      text: "نؤكد الدفع ونرسل لك مفتاح الترخيص على نفس المحادثة.",
      payment: true,
    },
    {
      icon: IconKey,
      title: "الصق المفتاح بالأسفل",
      text: "في خانة التفعيل، وتنفتح ميزات خطتك فوراً.",
    },
  ];

function HowToSubscribe() {
  return (
    <section aria-label="طريقة الاشتراك" className="border bg-muted/30 p-4">
      <h4 className="mb-3 text-xs font-semibold">الاشتراك في 3 خطوات</h4>
      <ol className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex items-start gap-3">
            <span className="relative flex size-9 shrink-0 items-center justify-center border bg-background">
              <step.icon className="size-4 text-primary" />
              <span className="absolute -top-2 -inset-e-2 flex size-4 items-center justify-center bg-primary font-mono text-[10px] text-primary-foreground">
                {i + 1}
              </span>
            </span>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold">{step.title}</p>
              <p className="text-[11px] text-muted-foreground">{step.text}</p>
              {step.payment && (
                <ul
                  aria-label="طرق الدفع المتاحة"
                  className="flex flex-wrap gap-1 pt-1"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <li
                      key={m}
                      className="border bg-background px-1.5 py-0.5 text-[10px] font-medium"
                    >
                      {m}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Assurance({
  icon: AssuranceIcon,
  children,
}: {
  icon: Icon;
  children: ReactNode;
}) {
  return (
    <li className="flex items-center gap-1.5">
      <AssuranceIcon className="size-3.5" />
      {children}
    </li>
  );
}
