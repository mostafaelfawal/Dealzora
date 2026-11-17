import {
  IconCash,
  IconChartBar,
  IconPackage,
  IconRocket,
  IconTruckDelivery,
  IconUsers,
  type Icon,
} from "@tabler/icons-react";

import { getYoutubeId } from "../lib/youtube";

/**
 * شروحات Dealzora بالفيديو. القسم يحدد مكان الشرح في صفحة /tutorials، وترتيب العناصر داخل
 * القسم = ترتيب التعلّم المقترح. `featured` يظهر في الصفحة الرئيسية (يُفضَّل 6).
 *
 * الروابط الحالية مؤقتة (معرّفات تبدأ بـ PLACEHOLD): استبدل كل youtubeUrl برابط الفيديو الحقيقي
 * بأي صيغة (youtube.com/watch?v= أو youtu.be/ أو embed/ أو shorts/) وستظهر صورته من يوتيوب تلقائياً.
 */

export type TutorialCategoryId =
  | "start"
  | "products"
  | "sales"
  | "purchases"
  | "contacts"
  | "finance";

export interface TutorialCategory {
  id: TutorialCategoryId;
  title: string;
  description: string;
  icon: Icon;
}

export const TUTORIAL_CATEGORIES: TutorialCategory[] = [
  {
    id: "start",
    title: "البدء باستخدام Dealzora",
    description: "من تثبيت البرنامج إلى تجهيز المحل والمستخدمين قبل أول عملية بيع.",
    icon: IconRocket,
  },
  {
    id: "products",
    title: "المنتجات والمخزون",
    description: "إضافة الأصناف والباركود والوحدات، ومتابعة المخزون والجرد.",
    icon: IconPackage,
  },
  {
    id: "sales",
    title: "المبيعات ونقطة البيع",
    description: "شاشة الكاشير والخصومات وطرق الدفع والمرتجعات والورديات.",
    icon: IconCash,
  },
  {
    id: "purchases",
    title: "المشتريات",
    description: "فواتير الشراء من الموردين ومرتجعاتها وطلبات الشراء من النواقص.",
    icon: IconTruckDelivery,
  },
  {
    id: "contacts",
    title: "العملاء والموردون",
    description: "البيع الآجل والتحصيل وأرصدة الموردين وكشوف الحساب.",
    icon: IconUsers,
  },
  {
    id: "finance",
    title: "الحسابات والتقارير",
    description: "الخزنة والمصروفات والتقارير والنسخ الاحتياطي.",
    icon: IconChartBar,
  },
];

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  youtubeUrl: string;
  category: TutorialCategoryId;
  /** صورة مخصصة؛ بدونها تُستخدم صورة يوتيوب للفيديو. */
  thumbnail?: string;
  duration?: string;
  featured?: boolean;
}

export const TUTORIALS: Tutorial[] = [
  // ---------- البدء ----------
  {
    id: "install",
    title: "تحميل البرنامج وتثبيته على ويندوز",
    description: "تحميل ملف التثبيت، وخطوات المعالج، وفتح البرنامج لأول مرة.",
    youtubeUrl: "https://youtu.be/PLACEHOLD01",
    category: "start",
    duration: "3:10",
    featured: true,
  },
  {
    id: "setup-shop",
    title: "إعداد بيانات المحل وحساب المالك",
    description: "اسم المحل والعملة وبيانات الإيصال، وإنشاء حساب المالك.",
    youtubeUrl: "https://youtu.be/PLACEHOLD02",
    category: "start",
    duration: "4:25",
  },
  {
    id: "tour",
    title: "جولة في واجهة البرنامج",
    description: "القائمة الجانبية والرئيسية والبحث السريع واختصارات لوحة المفاتيح.",
    youtubeUrl: "https://youtu.be/PLACEHOLD03",
    category: "start",
    duration: "5:40",
  },
  {
    id: "users",
    title: "إضافة المستخدمين وتحديد الصلاحيات",
    description: "إنشاء حسابات المدير والكاشير، والفرق بين صلاحيات كل دور.",
    youtubeUrl: "https://youtu.be/PLACEHOLD04",
    category: "start",
    duration: "4:05",
  },
  {
    id: "printer",
    title: "ضبط الطابعة الحرارية وتصميم الإيصال",
    description: "اختيار الطابعة، ومقاس الورق، وتخصيص شكل الإيصال ومعاينته.",
    youtubeUrl: "https://youtu.be/PLACEHOLD05",
    category: "start",
    duration: "4:50",
  },

  // ---------- المنتجات والمخزون ----------
  {
    id: "add-product",
    title: "إضافة صنف جديد بالباركود",
    description: "الاسم والقسم والباركود وسعر الشراء والبيع والكمية الافتتاحية.",
    youtubeUrl: "https://youtu.be/PLACEHOLD06",
    category: "products",
    duration: "4:15",
    featured: true,
  },
  {
    id: "units",
    title: "وحدات البيع الإضافية: الكرتونة والدستة",
    description: "بيع الصنف الواحد بأكثر من وحدة وسعر، مع خصم المخزون بدقة.",
    youtubeUrl: "https://youtu.be/PLACEHOLD07",
    category: "products",
    duration: "3:35",
  },
  {
    id: "import-excel",
    title: "استيراد الأصناف من ملف Excel",
    description: "تجهيز الملف، ومطابقة الأعمدة، ومراجعة النتيجة قبل الحفظ.",
    youtubeUrl: "https://youtu.be/PLACEHOLD08",
    category: "products",
    duration: "5:05",
  },
  {
    id: "barcode-labels",
    title: "طباعة ملصقات الباركود",
    description: "طباعة ملصقات للأصناف التي لا تحمل باركوداً من المصنع.",
    youtubeUrl: "https://youtu.be/PLACEHOLD09",
    category: "products",
    duration: "3:20",
  },
  {
    id: "stock",
    title: "متابعة المخزون وتسجيل الجرد والتالف",
    description: "النواقص والراكد، وتسويات الجرد، وحركة كل صنف بالتفصيل.",
    youtubeUrl: "https://youtu.be/PLACEHOLD10",
    category: "products",
    duration: "5:30",
    featured: true,
  },

  // ---------- المبيعات ----------
  {
    id: "first-sale",
    title: "أول عملية بيع على نقطة البيع",
    description: "إضافة الأصناف بالباركود أو البحث، وتحصيل المبلغ، وطباعة الإيصال.",
    youtubeUrl: "https://youtu.be/PLACEHOLD11",
    category: "sales",
    duration: "4:40",
    featured: true,
  },
  {
    id: "discounts-payments",
    title: "الخصومات وطرق الدفع",
    description: "الخصم على الصنف أو الفاتورة، والدفع نقداً أو آجلاً أو إلكترونياً.",
    youtubeUrl: "https://youtu.be/PLACEHOLD12",
    category: "sales",
    duration: "4:00",
  },
  {
    id: "hold",
    title: "تعليق الفاتورة واستكمالها لاحقاً",
    description: "خدمة أكثر من عميل في الوقت نفسه دون فقدان أي فاتورة.",
    youtubeUrl: "https://youtu.be/PLACEHOLD13",
    category: "sales",
    duration: "2:30",
  },
  {
    id: "returns",
    title: "مرتجع المبيعات الكلي والجزئي",
    description: "استرجاع صنف أو فاتورة كاملة، وأثره على المخزون والخزنة.",
    youtubeUrl: "https://youtu.be/PLACEHOLD14",
    category: "sales",
    duration: "3:45",
  },
  {
    id: "shifts",
    title: "فتح الوردية وإغلاقها وجرد الدرج",
    description: "رصيد البداية، وعدّ النقدية في آخر اليوم، وقراءة الفرق.",
    youtubeUrl: "https://youtu.be/PLACEHOLD15",
    category: "sales",
    duration: "4:20",
  },

  // ---------- المشتريات ----------
  {
    id: "purchase-invoice",
    title: "تسجيل فاتورة شراء من مورد",
    description: "إضافة الأصناف المشتراة وأسعارها، وتحديث المخزون وحساب المورد.",
    youtubeUrl: "https://youtu.be/PLACEHOLD16",
    category: "purchases",
    duration: "4:35",
  },
  {
    id: "purchase-returns",
    title: "مرتجع المشتريات",
    description: "إرجاع بضاعة للمورد وخصمها من المخزون ومن رصيده.",
    youtubeUrl: "https://youtu.be/PLACEHOLD17",
    category: "purchases",
    duration: "2:55",
  },
  {
    id: "purchase-orders",
    title: "طلبات الشراء من النواقص",
    description: "تجهيز طلب شراء تلقائي بالأصناف التي قاربت على النفاد.",
    youtubeUrl: "https://youtu.be/PLACEHOLD18",
    category: "purchases",
    duration: "3:25",
  },

  // ---------- العملاء والموردون ----------
  {
    id: "credit-sales",
    title: "البيع الآجل والحد الائتماني",
    description: "إضافة عميل، والبيع له بالآجل، وضبط الحد الأقصى لدينه.",
    youtubeUrl: "https://youtu.be/PLACEHOLD19",
    category: "contacts",
    duration: "4:10",
    featured: true,
  },
  {
    id: "collections",
    title: "تحصيل الديون وكشف حساب العميل",
    description: "تسجيل دفعات العملاء ومراجعة كشف الحساب وإرساله على واتساب.",
    youtubeUrl: "https://youtu.be/PLACEHOLD20",
    category: "contacts",
    duration: "3:50",
  },
  {
    id: "supplier-accounts",
    title: "حسابات الموردين ودفعاتهم",
    description: "متابعة المستحق لكل مورد وتسجيل ما دفعته له.",
    youtubeUrl: "https://youtu.be/PLACEHOLD21",
    category: "contacts",
    duration: "3:15",
  },

  // ---------- الحسابات والتقارير ----------
  {
    id: "treasury",
    title: "الخزنة والمصروفات اليومية",
    description: "تسجيل المصروفات والحركات اليدوية، وقراءة رصيد الخزنة.",
    youtubeUrl: "https://youtu.be/PLACEHOLD22",
    category: "finance",
    duration: "3:40",
  },
  {
    id: "reports",
    title: "قراءة التقارير واتخاذ القرار",
    description: "تقارير المبيعات والأصناف والمخزون والديون، وتصديرها PDF.",
    youtubeUrl: "https://youtu.be/PLACEHOLD23",
    category: "finance",
    duration: "6:10",
    featured: true,
  },
  {
    id: "backup",
    title: "النسخ الاحتياطي واستعادة البيانات",
    description: "النسخة اليومية التلقائية، والحفظ على فلاشة، والاستعادة بضغطة.",
    youtubeUrl: "https://youtu.be/PLACEHOLD24",
    category: "finance",
    duration: "3:05",
  },
];

/** شرح جاهز للعرض: معرّف الفيديو مستخرج، ورقمه داخل قسمه. */
export interface ResolvedTutorial extends Tutorial {
  videoId: string;
  /** ترتيب الشرح داخل قسمه (1، 2، 3…). */
  lesson: number;
}

const categoryOrder = new Map(TUTORIAL_CATEGORIES.map((c, i) => [c.id, i]));

/** الشروحات ذات الروابط الصالحة فقط، مرتبة حسب القسم ثم ترتيب التعلّم. */
export const RESOLVED_TUTORIALS: ResolvedTutorial[] = (() => {
  const counters = new Map<TutorialCategoryId, number>();
  return TUTORIALS.flatMap((t) => {
    const videoId = getYoutubeId(t.youtubeUrl);
    if (!videoId) return [];
    const lesson = (counters.get(t.category) ?? 0) + 1;
    counters.set(t.category, lesson);
    return [{ ...t, videoId, lesson }];
  }).sort(
    (a, b) =>
      (categoryOrder.get(a.category) ?? 0) - (categoryOrder.get(b.category) ?? 0),
  );
})();

export const CATEGORY_BY_ID = new Map(TUTORIAL_CATEGORIES.map((c) => [c.id, c]));

export function tutorialsIn(category: TutorialCategoryId): ResolvedTutorial[] {
  return RESOLVED_TUTORIALS.filter((t) => t.category === category);
}

export const FEATURED_TUTORIALS = RESOLVED_TUTORIALS.filter((t) => t.featured);

/** رابط مؤقت لم يُستبدل بعد بفيديو حقيقي: نعرض غلافاً بهوية Dealzora بدل صورة يوتيوب. */
export const isPlaceholderVideo = (videoId: string) =>
  videoId.startsWith("PLACEHOLD");

/** «شرح واحد / شرحان / 5 شروح / 24 شرحًا» حسب قواعد العدد في العربية. */
export function lessonsLabel(n: number): string {
  if (n === 1) return "شرح واحد";
  if (n === 2) return "شرحان";
  if (n >= 3 && n <= 10) return `${n} شروح`;
  return `${n} شرحًا`;
}
