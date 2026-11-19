import {
  IconBrandWhatsapp,
  IconCash,
  IconCheck,
  IconDatabase,
  IconHeadset,
  IconKey,
  IconMinus,
  IconRefresh,
  type Icon,
} from "@tabler/icons-react";

import { FEATURE_INFO } from "@/config/planFeatures";
import {
  PAYMENT_METHODS,
  PLANS,
  type PlanStats,
} from "@/features/settings/config/plans";

import { PlanCards } from "./planCards";
import { Container, Section, SectionHeading } from "./primitives";

/**
 * الخطط والأسعار والميزات والحدود كلها من جدول البرنامج نفسه (features/settings/config/plans.ts)
 * المحميّ في الـ backend: أي تعديل في الأسعار هناك يظهر هنا تلقائياً.
 */

const STAT_ROWS: { key: keyof PlanStats; label: string }[] = [
  { key: "devices", label: "الأجهزة" },
  { key: "users", label: "المستخدمون" },
  { key: "products", label: "الأصناف" },
  { key: "branches", label: "الفروع" },
];

const RANK = Object.fromEntries(PLANS.map((p, i) => [p.name, i])) as Record<
  string,
  number
>;

// الميزات مرتبة حسب الخطة التي تفتحها (من FEATURE_INFO نفسه).
const FEATURE_ROWS = Object.values(FEATURE_INFO).sort(
  (a, b) => RANK[a.plan] - RANK[b.plan],
);

/** نفس خطوات الاشتراك في صفحة «الخطة والترخيص» بالبرنامج. */
const STEPS: { icon: Icon; title: string; text: string; payment?: boolean }[] =
  [
    {
      icon: IconBrandWhatsapp,
      title: "اختر خطتك واضغط «اشترك»",
      text: "يُفتح واتساب برسالة جاهزة فيها الخطة ونوع الاشتراك والمبلغ.",
    },
    {
      icon: IconCash,
      title: "ادفع بالطريقة المناسبة لك",
      text: "نؤكد الدفع ونرسل لك مفتاح الترخيص على المحادثة نفسها.",
      payment: true,
    },
    {
      icon: IconKey,
      title: "فعّل المفتاح في البرنامج",
      text: "من الإعدادات ← الخطة والترخيص، فتنفتح ميزات خطتك فوراً.",
    },
  ];

const ASSURANCES: { icon: Icon; text: string }[] = [
  { icon: IconDatabase, text: "بياناتك تبقى كما هي عند أي تغيير" },
  { icon: IconRefresh, text: "ترقية أو تغيير الخطة في أي وقت" },
  { icon: IconHeadset, text: "دعم فني على واتساب" },
];

function HowToSubscribe() {
  return (
    <section aria-labelledby="how-subscribe" className="border bg-muted/40">
      <h3 id="how-subscribe" className="border-b px-6 py-4 text-base font-bold">
        الاشتراك في 3 خطوات
      </h3>
      <ol className="grid gap-px bg-border md:grid-cols-3">
        {STEPS.map((step, i) => (
          <li
            key={step.title}
            className="flex items-start gap-4 bg-background p-6"
          >
            <span className="relative flex size-11 shrink-0 items-center justify-center border">
              <step.icon className="size-5" aria-hidden />
              <span
                className="absolute -top-2 -left-2 flex size-5 items-center justify-center bg-primary font-mono text-[11px] text-primary-foreground"
                dir="ltr"
              >
                {i + 1}
              </span>
            </span>
            <div className="space-y-1.5">
              <p className="font-semibold">{step.title}</p>
              <p className="text-sm leading-6 text-muted-foreground">
                {step.text}
              </p>
              {step.payment && (
                <ul
                  aria-label="طرق الدفع المتاحة"
                  className="flex flex-wrap gap-1.5 pt-1"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <li
                      key={m}
                      className="border bg-background px-2 py-0.5 text-xs font-medium"
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
      <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 border-t px-6 py-4 text-sm text-muted-foreground">
        {ASSURANCES.map(({ icon: AIcon, text }) => (
          <li key={text} className="flex items-center gap-2">
            <AIcon className="size-4" aria-hidden />
            {text}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PricingSection() {
  return (
    <Section id="pricing" aria-labelledby="pricing-title">
      <Container className="space-y-12">
        <SectionHeading
          id="pricing-title"
          index="05"
          eyebrow="الباقات والأسعار"
          title="اختر الباقة المناسبة لنشاطك التجاري"
          lead="ابدأ مجاناً بخطة «بَسطة»، ثم اشترك شهرياً أو سنوياً عندما يكبر محلك، دون أن تفقد بياناتك. الاشتراك السنوي يوفّر عليك شهرين."
          align="center"
        />

        <PlanCards />

        <HowToSubscribe />

        {/* جدول المقارنة للشاشات المتوسطة فأكبر؛ في الهاتف تكفي البطاقات أعلاه. */}
        <div className="hidden space-y-4 md:block">
          <h3 className="text-xl font-bold">مقارنة تفصيلية بين الخطط</h3>
          <div className="overflow-x-auto border">
            <table className="w-full min-w-[44rem] border-collapse text-sm">
              <caption className="sr-only">
                مقارنة حدود وميزات خطط Dealzora
              </caption>
              <thead className="bg-muted">
                <tr>
                  <th scope="col" className="p-4 text-start font-semibold">
                    الميزة
                  </th>
                  {PLANS.map((p) => (
                    <th
                      key={p.id}
                      scope="col"
                      className="w-36 p-4 text-center font-semibold"
                    >
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STAT_ROWS.map((r) => (
                  <tr key={r.key} className="border-t">
                    <th scope="row" className="p-4 text-start font-medium">
                      {r.label}
                    </th>
                    {PLANS.map((p) => (
                      <td key={p.id} className="p-4 text-center">
                        {p.stats[r.key]}
                      </td>
                    ))}
                  </tr>
                ))}
                {FEATURE_ROWS.map((f) => (
                  <tr key={f.name} className="border-t">
                    <th scope="row" className="p-4 text-start font-normal">
                      {f.name}
                    </th>
                    {PLANS.map((p, i) => {
                      const has = i >= RANK[f.plan];
                      return (
                        <td key={p.id} className="p-4 text-center">
                          {has ? (
                            <IconCheck
                              className="mx-auto size-4 text-success"
                              role="img"
                              aria-label="متاحة"
                            />
                          ) : (
                            <IconMinus
                              className="mx-auto size-4 text-muted-foreground/60"
                              role="img"
                              aria-label="غير متاحة"
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Container>
    </Section>
  );
}
