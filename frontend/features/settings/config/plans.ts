import type { PlanInfo } from "@/lib/plan";

/**
 * خطط Dealzora كما تُعرض للعميل في الإعدادات.
 * الأسعار بالجنيه المصري (سعر بيع البرنامج، لا علاقة لها بعملة المحل).
 * الاشتراك السنوي = 10 أشهر (شهرين مجاناً).
 */
export type PlanId = PlanInfo["plan"];
export type Billing = "monthly" | "yearly";

export interface PlanCard {
  id: PlanId;
  name: string;
  tagline: string;
  /** null = مجانية. */
  monthly: number | null;
  yearly: number | null;
  /** «يبدأ من» للخطط التي يتحدد سعرها حسب عدد الأجهزة والفروع. */
  startsFrom?: boolean;
  /** الخطة السابقة: أول سطر «كل ما في خطة …». */
  includes?: string;
  features: string[];
  popular?: boolean;
}

export { SUPPORT_WHATSAPP as SALES_WHATSAPP } from "@/config/support";
export const PLAN_CURRENCY = "ج.م";

export const PLANS: PlanCard[] = [
  {
    id: "free",
    name: "بَسطة",
    tagline: "للمحل الصغير اللي لسه بيبدأ",
    monthly: null,
    yearly: null,
    features: [
      "جهاز واحد ومستخدم واحد (المالك)",
      "حتى 300 صنف بالباركود والأقسام",
      "بيع كاش سريع وطباعة على الطابعة الحرارية",
      "المرتجع وتعليق الفاتورة",
      "الورديات وجرد الدرج",
      "نسخة احتياطية تلقائية مشفّرة كل يوم",
      "تقارير آخر 7 أيام",
    ],
  },
  {
    id: "basic",
    name: "دُكّان",
    tagline: "للبقالة والصيدلية والمحل العادي",
    monthly: 349,
    yearly: 3490,
    includes: "بَسطة",
    features: [
      "أصناف بلا حد، و3 مستخدمين (مدير و2 كاشير)",
      "العملاء والبيع الآجل والحد الائتماني والتحصيل",
      "الموردين والمشتريات ومرتجع المشتريات",
      "المصروفات وحركة الخزنة اليومية",
      "وحدات بيع إضافية (كرتونة، دستة…)",
      "طباعة ملصقات الباركود",
      "استيراد وتصدير الأصناف من Excel",
      "إرسال الفاتورة على واتساب",
      "فودافون كاش وإنستاباي كطرق دفع",
      "نسخ احتياطي على فلاشة أو قرص آخر واستعادة بضغطة",
      "تقارير سنة كاملة",
      "دعم فني على واتساب",
    ],
  },
  {
    id: "pro",
    name: "سوق",
    tagline: "للسوبر ماركت وأكثر من كاشير",
    monthly: 699,
    yearly: 6990,
    includes: "دُكّان",
    popular: true,
    features: [
      "جهازين كاشير متصلين بالجهاز الأساسي (+99 ج.م/شهر لكل جهاز إضافي)",
      "مستخدمين بلا حد",
      "سجل العمليات: مين عمل إيه وإمتى",
      "تقارير الربح لكل صنف والراكد بلا حد زمني",
      "ملخص يومي للمالك على واتساب كل ليلة",
      "باركود الميزان للأصناف الموزونة",
      "تذكير تلقائي بالديون وكشف حساب PDF للعميل",
      "العروض التلقائية (اشتري 2 وخد 1)",
      "أسعار جملة وقطاعي",
      "طلبات شراء ذكية من النواقص",
      "دعم فني أولوية",
    ],
  },
  {
    id: "enterprise",
    name: "سلسلة",
    tagline: "للمحلات الكبيرة والفروع",
    monthly: 1999,
    yearly: 19990,
    startsFrom: true,
    includes: "سوق",
    features: [
      "حتى 10 أجهزة كاشير",
      "تعدد الفروع وتحويل المخزون بينها",
      "الإيصال الإلكتروني (منظومة الضرائب ETA)",
      "نقاط ولاء للعملاء",
      "تتبع الصلاحية والدفعات",
      "تطبيق موبايل للمالك بتقارير لحظية",
      "تركيب وتدريب في المحل",
      "رقم دعم مباشر وتخصيصات حسب احتياجك",
    ],
  },
];

export const BILLING_LABEL: Record<Billing, string> = {
  monthly: "شهري",
  yearly: "سنوي",
};

export const formatPlanPrice = (n: number) =>
  `${n.toLocaleString("en-US")} ${PLAN_CURRENCY}`;

/** رسالة واتساب جاهزة: كل ما نحتاجه لإصدار مفتاح الترخيص. */
export function subscribeMessage({
  plan,
  billing,
  machineId,
  shopName,
}: {
  plan: PlanCard;
  billing: Billing;
  machineId: string;
  shopName: string | null;
}): string {
  const price = billing === "monthly" ? plan.monthly : plan.yearly;
  const amount = price === null ? "—" : formatPlanPrice(price);
  return [
    "السلام عليكم،",
    `أريد الاشتراك في خطة «${plan.name}» من Dealzora.`,
    "",
    `• نوع الاشتراك: ${BILLING_LABEL[billing]}`,
    `• المبلغ: ${plan.startsFrom ? "يبدأ من " : ""}${amount}${billing === "monthly" ? " شهرياً" : " سنوياً"}`,
    shopName ? `• اسم المحل: ${shopName}` : null,
    `• رقم الجهاز: ${machineId}`,
    "",
    "برجاء إرسال مفتاح الترخيص بعد تأكيد الدفع. شكراً.",
  ]
    .filter((l) => l !== null)
    .join("\n");
}
