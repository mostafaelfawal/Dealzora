import type { PlanInfo } from "@/lib/plan";

/**
 * خطط Dealzora كما تُعرض للعميل في الإعدادات.
 * الأسعار بالجنيه المصري (سعر بيع البرنامج، لا علاقة لها بعملة المحل).
 * الاشتراك السنوي = 10 أشهر (شهرين مجاناً).
 *
 * كل ميزة هنا محمية فعلاً بنفس الخطة في backend/app/core/plan.py (_UNLOCKED_IN و PLAN_LIMITS)
 * وفي الواجهة lib/plan.ts (FEATURE_INFO). أي نقل لميزة بين الخطط = تعديل الثلاثة معاً.
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
  /** ميزات معلنة لم تُبنَ بعد: تظهر بعلامة «قريباً» (لا نبيع ما ليس موجوداً). */
  soon?: string[];
  popular?: boolean;
  /** ملخص سريع للمقارنة بين الكروت بنظرة واحدة (نفس ترتيب الصفوف في كل خطة). */
  stats: PlanStats;
}

export interface PlanStats {
  devices: string;
  users: string;
  products: string;
  branches: string;
}

export { SUPPORT_WHATSAPP as SALES_WHATSAPP } from "@/config/support";
export const PLAN_CURRENCY = "ج.م";

export const PLANS: PlanCard[] = [
  {
    id: "free",
    stats: {
      devices: "جهاز واحد",
      users: "المالك فقط",
      products: "حتى 300",
      branches: "فرع واحد",
    },
    name: "بَسطة",
    tagline: "للمحل الصغير في بدايته",
    monthly: null,
    yearly: null,
    features: [
      "جهاز واحد ومستخدم واحد (المالك)",
      "حتى 300 صنف بالباركود والأقسام",
      "بيع نقدي سريع وطباعة على الطابعة الحرارية",
      "المرتجع وتعليق الفاتورة",
      "الورديات وجرد الدرج",
      "نسخة احتياطية تلقائية مشفّرة كل يوم",
      "تقارير آخر 7 أيام",
    ],
  },
  {
    id: "basic",
    stats: {
      devices: "جهاز واحد",
      users: "3 مستخدمين",
      products: "بلا حد",
      branches: "فرع واحد",
    },
    name: "دُكّان",
    tagline: "للبقالة والمحل العادي",
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
      "الدفع الإلكتروني حسب دولتك (محافظ، بطاقات، تحويلات)",
      "نسخ احتياطي على فلاشة أو قرص آخر واستعادة بضغطة",
      "تقارير سنة كاملة",
      "دعم فني على واتساب",
    ],
  },
  {
    id: "pro",
    stats: {
      devices: "3 أجهزة",
      users: "بلا حد",
      products: "بلا حد",
      branches: "فرع واحد",
    },
    name: "سوق",
    tagline: "للسوبر ماركت والصيدلية وأكثر من كاشير",
    monthly: 699,
    yearly: 6990,
    includes: "دُكّان",
    popular: true,
    features: [
      "جهازا كاشير متصلان بالجهاز الأساسي (+99 ج.م/شهر لكل جهاز إضافي)",
      "عدد غير محدود من المستخدمين",
      "سجل العمليات: من فعل ماذا ومتى",
      "الإيصال الإلكتروني (منظومة الضرائب ETA)",
      "تتبع الصلاحية والدفعات (للصيدلية والأغذية)",
      "العروض التلقائية (اشترِ 2 واحصل على 1)",
      "أسعار جملة وقطاعي وعملاء جملة",
      "نقاط ولاء للعملاء",
      "باركود الميزان للأصناف الموزونة",
      "طلبات شراء ذكية من النواقص",
      "كشف حساب العميل PDF وإرساله له على واتساب",
      "نظام التقسيط بلا فائدة: مقدّم وجدول أقساط ومتابعة المتأخر",
      "التقارير بلا حد زمني",
      "دعم فني أولوية",
    ],
  },
  {
    id: "enterprise",
    stats: {
      devices: "حتى 10",
      users: "بلا حد",
      products: "بلا حد",
      branches: "فروع متعددة",
    },
    name: "سلسلة",
    tagline: "للمحلات الكبيرة والفروع",
    monthly: 1999,
    yearly: 19990,
    startsFrom: true,
    includes: "سوق",
    features: [
      "حتى 10 أجهزة كاشير",
      "تعدد الفروع وتحويل المخزون بينها",
      "كتالوج أصناف وأسعار موحّد لكل الفروع",
      "متجر إلكتروني برابط خاص بمحلك والدفع عند الاستلام",
      "تطبيق موبايل للمالك بتقارير لحظية وموافقة التحويلات",
      "ملخص يومي وأسبوعي على الموبايل مع تحليل سريع لمبيعاتك",
      "تركيب وتدريب في المحل",
      "رقم دعم مباشر وتخصيصات حسب احتياجك",
    ],
  },
];

/** طرق دفع الاشتراك المتاحة (تُعرض في خطوات الاشتراك). */
export const PAYMENT_METHODS = [
  "فودافون كاش",
  "إنستاباي",
  "Binance",
  "كاش",
] as const;

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
