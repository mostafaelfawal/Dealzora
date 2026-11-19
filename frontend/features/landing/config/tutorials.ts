import {
  IconBuildingBank,
  IconBuildingStore,
  IconBuildingWarehouse,
  IconChartBar,
  IconDevices,
  IconDiscount2,
  IconFileCertificate,
  IconPackage,
  IconReceipt,
  IconRocket,
  IconSettings,
  IconShoppingCart,
  IconTruckDelivery,
  IconUsers,
  type Icon,
} from "@tabler/icons-react";

import { getYoutubeId } from "../lib/youtube";

/**
 * مكتبة شروحات Dealzora بالفيديو، مبنية على شاشات البرنامج كلها.
 *
 * لإضافة فيديو: الصق رابطه في `youtubeUrl` بأي صيغة (youtube.com/watch?v= أو youtu.be/ أو
 * embed/ أو shorts/). الصورة المصغرة تُجلب من يوتيوب تلقائياً، والمدة (mm:ss) تُقرأ من يوتيوب
 * وقت البناء (انظر lib/youtubeDurations.ts). الشرح بلا رابط يظهر ببطاقة «قريباً» غير قابلة للتشغيل.
 *
 * القسم يحدد مكان الشرح في صفحة /tutorials، وترتيب العناصر داخل القسم = ترتيب التعلّم المقترح.
 * `featured` يظهر في الصفحة الرئيسية (يُفضَّل 6).
 */

export type TutorialCategoryId =
  | "start"
  | "products"
  | "inventory"
  | "pos"
  | "invoices"
  | "promotions"
  | "purchases"
  | "contacts"
  | "finance"
  | "reports"
  | "settings"
  | "devices"
  | "online-store"
  | "e-receipt";

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
    description:
      "من تثبيت البرنامج إلى تجهيز المحل والمستخدمين قبل أول عملية بيع.",
    icon: IconRocket,
  },
  {
    id: "products",
    title: "المنتجات",
    description:
      "إضافة الأصناف والباركود والأقسام والوحدات، والاستيراد والتصدير بملفات Excel.",
    icon: IconPackage,
  },
  {
    id: "inventory",
    title: "المخزون والصلاحية",
    description:
      "متابعة الكميات والنواقص، والجرد والتالف، وحركة كل صنف، وتواريخ الصلاحية.",
    icon: IconBuildingWarehouse,
  },
  {
    id: "pos",
    title: "نقطة البيع (الكاشير)",
    description:
      "شاشة البيع، والباركود والميزان، والخصومات، وطرق الدفع، والتعليق والاستبدال.",
    icon: IconShoppingCart,
  },
  {
    id: "invoices",
    title: "الفواتير والورديات",
    description:
      "سجل الفواتير والمرتجعات، وفتح الوردية وإغلاقها ومراجعة فروق الدرج.",
    icon: IconReceipt,
  },
  {
    id: "promotions",
    title: "العروض ونقاط الولاء",
    description:
      "عروض الخصم المجدولة، ونقاط الولاء التي تعيد العميل للشراء منك.",
    icon: IconDiscount2,
  },
  {
    id: "purchases",
    title: "المشتريات وطلبات الشراء",
    description:
      "فواتير الشراء من الموردين ومرتجعاتها، وطلبات الشراء من النواقص.",
    icon: IconTruckDelivery,
  },
  {
    id: "contacts",
    title: "العملاء والموردون",
    description:
      "البيع الآجل والتقسيط، والحد الائتماني، والتحصيل، وأرصدة الموردين، وكشوف الحساب.",
    icon: IconUsers,
  },
  {
    id: "finance",
    title: "الخزنة والمصروفات",
    description: "المصروفات اليومية، وحركات الخزنة، وقراءة الشاشة الرئيسية.",
    icon: IconBuildingBank,
  },
  {
    id: "reports",
    title: "التقارير وسجل العمليات",
    description:
      "تقارير المبيعات والأصناف والمخزون والعملاء والخزنة، وتصديرها، وسجل العمليات.",
    icon: IconChartBar,
  },
  {
    id: "settings",
    title: "الإعدادات والطباعة",
    description:
      "بيانات المحل والعملة والضريبة، والطابعة وشكل الفاتورة، والنسخ الاحتياطي والخطة.",
    icon: IconSettings,
  },
  {
    id: "devices",
    title: "الأجهزة والفروع",
    description:
      "أجهزة الكاشير الإضافية، وربط الفروع وتحويل البضاعة بينها، وتطبيق الهاتف.",
    icon: IconDevices,
  },
  {
    id: "online-store",
    title: "المتجر الإلكتروني",
    description:
      "متجر على الإنترنت برابط خاص بمحلك، يستقبل طلبات العملاء والدفع عند الاستلام.",
    icon: IconBuildingStore,
  },
  {
    id: "e-receipt",
    title: "الإيصال الإلكتروني",
    description:
      "الربط مع منظومة الإيصال الإلكتروني لمصلحة الضرائب خطوة بخطوة.",
    icon: IconFileCertificate,
  },
];

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  /** رابط الفيديو على يوتيوب. فارغ = «قريباً». */
  youtubeUrl: string;
  category: TutorialCategoryId;
  /** صورة مخصصة؛ بدونها تُستخدم صورة يوتيوب للفيديو. */
  thumbnail?: string;
  /** مدة يدوية (mm:ss) تُستخدم فقط إن تعذّر جلبها من يوتيوب. */
  duration?: string;
  featured?: boolean;
}

export const TUTORIALS: Tutorial[] = [
  // ---------- البدء ----------
  {
    id: "install",
    title: "تحميل البرنامج وتثبيته على ويندوز",
    description: "تحميل ملف التثبيت، وخطوات المعالج، وفتح البرنامج لأول مرة.",
    youtubeUrl: "https://youtu.be/w4lM7RW36rI?si=jZF1nCbC81RjLV5X",
    category: "start",
    featured: true,
  },
  {
    id: "setup-shop",
    title: "الإعداد الأول: بيانات المحل وحساب المالك",
    description:
      "اسم المحل وحساب المالك، وتفعيل خطة «بَسطة» المجانية تلقائياً، ثم ضبط العملة من الإعدادات.",
    youtubeUrl: "",
    category: "start",
  },
  {
    id: "login-roles",
    title: "تسجيل الدخول للمدير والكاشير",
    description: "الدخول بحساب المدير أو الكاشير، والفرق بين ما يراه كل منهما.",
    youtubeUrl: "",
    category: "start",
  },
  {
    id: "tour",
    title: "جولة في واجهة البرنامج",
    description:
      "القائمة الجانبية ومجموعاتها، والبحث الشامل، والتنقل بين الصفحات بـ Alt والأرقام.",
    youtubeUrl: "",
    category: "start",
  },
  {
    id: "demo-data",
    title: "تجربة البرنامج بالبيانات التجريبية",
    description:
      "تحميل بيانات تجريبية للتعرف على البرنامج، ثم حذفها قبل البدء الفعلي.",
    youtubeUrl: "",
    category: "start",
  },
  {
    id: "users",
    title: "إضافة المستخدمين وتحديد الصلاحيات",
    description:
      "إنشاء حسابات المديرين والكاشير، وتعديلها وإيقافها، والفرق بين صلاحيات كل دور.",
    youtubeUrl: "",
    category: "start",
  },
  {
    id: "passwords",
    title: "تغيير كلمة المرور وإعادة تعيينها لموظف",
    description:
      "تغيير كلمة مرورك من «حسابي»، وإعادة تعيين كلمة مرور موظف نسيها.",
    youtubeUrl: "",
    category: "start",
  },

  // ---------- المنتجات ----------
  {
    id: "add-product",
    title: "إضافة صنف جديد بالباركود",
    description:
      "الاسم والقسم والباركود وسعر الشراء والبيع والكمية الافتتاحية.",
    youtubeUrl: "",
    category: "products",
    featured: true,
  },
  {
    id: "categories-units",
    title: "إدارة الأقسام والوحدات",
    description: "إنشاء أقسام الأصناف ووحدات القياس وتعديلها من نافذة واحدة.",
    youtubeUrl: "",
    category: "products",
  },
  {
    id: "product-units",
    title: "وحدات البيع الإضافية: الكرتونة والدستة",
    description: "بيع الصنف الواحد بأكثر من وحدة وسعر، مع خصم المخزون بدقة.",
    youtubeUrl: "",
    category: "products",
  },
  {
    id: "product-pricing",
    title: "الأسعار وهامش الربح وضريبة الصنف",
    description:
      "سعر الشراء والبيع، وقراءة هامش الربح، وضبط ضريبة القيمة المضافة لكل صنف.",
    youtubeUrl: "",
    category: "products",
  },
  {
    id: "products-list",
    title: "البحث في الأصناف وتعديلها وحذفها",
    description:
      "البحث والتصفية والترتيب في قائمة المنتجات، وتعديل صنف أو حذفه.",
    youtubeUrl: "",
    category: "products",
  },
  {
    id: "price-lookup",
    title: "معرفة سعر السوق للصنف قبل التسعير",
    description:
      "البحث عن سعر الصنف في السوق باسمه وقسمه ووحدته قبل تحديد سعر البيع.",
    youtubeUrl: "",
    category: "products",
  },
  {
    id: "import-excel",
    title: "استيراد الأصناف من ملف Excel",
    description:
      "تجهيز الملف أو سحبه إلى الشاشة، ومطابقة الأعمدة، ومراجعة النتيجة قبل الحفظ.",
    youtubeUrl: "",
    category: "products",
  },
  {
    id: "export-excel",
    title: "تصدير الأصناف إلى Excel",
    description:
      "حفظ قائمة الأصناف بأسعارها وكمياتها في ملف Excel للمراجعة أو التعديل.",
    youtubeUrl: "",
    category: "products",
  },
  {
    id: "barcode-labels",
    title: "طباعة ملصقات الباركود",
    description:
      "طباعة ملصقات للأصناف التي لا تحمل باركوداً من المصنع، وضبط مقاس الملصق.",
    youtubeUrl: "",
    category: "products",
  },

  // ---------- المخزون والصلاحية ----------
  {
    id: "stock",
    title: "متابعة المخزون: النواقص والراكد",
    description:
      "قراءة شاشة المخزون، وقيمة البضاعة، والأصناف التي قاربت على النفاد.",
    youtubeUrl: "",
    category: "inventory",
  },
  {
    id: "adjust-stock",
    title: "الجرد وتسوية المخزون وتسجيل التالف",
    description:
      "تصحيح الكمية بعد الجرد، وتسجيل التالف والفاقد مع سبب كل حركة.",
    youtubeUrl: "",
    category: "inventory",
  },
  {
    id: "item-ledger",
    title: "حركة الصنف بالتفصيل",
    description: "كل ما دخل الصنف وخرج منه: مبيعات ومشتريات ومرتجعات وتسويات.",
    youtubeUrl: "",
    category: "inventory",
  },
  {
    id: "expiry",
    title: "متابعة تواريخ الصلاحية",
    description:
      "دفعات كل صنف وتواريخ انتهائها، والتنبيه قبل الانتهاء، وإعدام الدفعة المنتهية.",
    youtubeUrl: "",
    category: "inventory",
  },

  // ---------- نقطة البيع ----------
  {
    id: "first-sale",
    title: "أول عملية بيع على نقطة البيع",
    description:
      "إضافة الأصناف بالباركود أو البحث، وتحصيل المبلغ، وطباعة الإيصال.",
    youtubeUrl: "",
    category: "pos",
    featured: true,
  },
  {
    id: "pos-search",
    title: "البحث عن الأصناف وتعديل الكميات",
    description:
      "البحث بالاسم أو الباركود، واستعراض الأصناف، وتعديل الكمية والوحدة في السلة.",
    youtubeUrl: "",
    category: "pos",
  },
  {
    id: "scale-barcode",
    title: "بيع الأصناف الموزونة بباركود الميزان",
    description: "ضبط ميزان الملصقات، ومسح الملصق ليُضاف الصنف بوزنه وسعره.",
    youtubeUrl: "",
    category: "pos",
  },
  {
    id: "discounts",
    title: "الخصم على الصنف والفاتورة",
    description: "الخصم بنسبة أو بمبلغ، وأقصى خصم مسموح للكاشير.",
    youtubeUrl: "",
    category: "pos",
  },
  {
    id: "payments",
    title: "طرق الدفع: نقداً وبطاقة ومحافظ إلكترونية",
    description: "تحصيل المبلغ بالطريقة التي يختارها العميل، وحساب الباقي.",
    youtubeUrl: "",
    category: "pos",
  },
  {
    id: "pos-customer",
    title: "اختيار العميل والبيع الآجل من الكاشير",
    description:
      "ربط الفاتورة بعميل، ومعرفة دينه والمتاح من حده الائتماني، والبيع له بالآجل.",
    youtubeUrl: "",
    category: "pos",
  },
  {
    id: "hold",
    title: "تعليق الفاتورة واستكمالها لاحقاً",
    description: "خدمة أكثر من عميل في الوقت نفسه دون فقدان أي فاتورة.",
    youtubeUrl: "",
    category: "pos",
  },
  {
    id: "pos-return",
    title: "المرتجع من شاشة الكاشير",
    description:
      "استرجاع صنف أو فاتورة كاملة بمسح باركود الإيصال، وأثره على المخزون والدرج.",
    youtubeUrl: "",
    category: "pos",
  },
  {
    id: "exchange",
    title: "استبدال صنف بآخر وتسوية الفرق",
    description: "تسجيل المرتجع والبيع الجديد معاً، ودفع الفرق أو رده فقط.",
    youtubeUrl: "",
    category: "pos",
  },
  {
    id: "second-currency",
    title: "عرض السعر بعملة ثانية",
    description:
      "إظهار المقابل بالدولار أو غيره في البيع والإيصال، وتحديث سعر الصرف.",
    youtubeUrl: "",
    category: "pos",
  },
  {
    id: "pos-shortcuts",
    title: "اختصارات لوحة المفاتيح للكاشير",
    description:
      "البيع كله من لوحة المفاتيح: البحث والكمية والدفع والتعليق دون الفأرة.",
    youtubeUrl: "",
    category: "pos",
  },

  // ---------- الفواتير والورديات ----------
  {
    id: "shifts",
    title: "فتح الوردية وإغلاقها وجرد الدرج",
    description: "رصيد البداية، وعدّ النقدية في آخر اليوم، وإغلاق الوردية.",
    youtubeUrl: "",
    category: "invoices",
  },
  {
    id: "shift-review",
    title: "مراجعة الورديات وفروق الدرج",
    description: "سجل الورديات لكل كاشير، وقراءة العجز والزيادة في كل وردية.",
    youtubeUrl: "",
    category: "invoices",
  },
  {
    id: "invoices",
    title: "سجل الفواتير وإعادة طباعة الإيصال",
    description:
      "البحث في الفواتير وتصفيتها، وعرض تفاصيل فاتورة، وإعادة طباعتها.",
    youtubeUrl: "",
    category: "invoices",
  },
  {
    id: "returns",
    title: "مرتجع المبيعات وسجل المرتجعات",
    description:
      "إرجاع صنف من فاتورة سابقة كلياً أو جزئياً، ومتابعة كل المرتجعات.",
    youtubeUrl: "",
    category: "invoices",
  },

  // ---------- العروض ونقاط الولاء ----------
  {
    id: "promotions",
    title: "إنشاء عروض الخصم وجدولتها",
    description:
      "خصم بنسبة أو «اشترِ واحصل على»، وتحديد الأصناف ومدة العرض وإيقافه.",
    youtubeUrl: "",
    category: "promotions",
  },
  {
    id: "loyalty-setup",
    title: "إعداد نقاط الولاء",
    description: "عدد النقاط لكل مبلغ، وقيمة النقطة عند الاستبدال.",
    youtubeUrl: "",
    category: "promotions",
  },
  {
    id: "loyalty-use",
    title: "كسب النقاط واستبدالها عند البيع",
    description:
      "رصيد نقاط العميل، واستبدالها خصماً في نقطة البيع، وتعديلها يدوياً.",
    youtubeUrl: "",
    category: "promotions",
  },

  // ---------- المشتريات ----------
  {
    id: "purchase-invoice",
    title: "تسجيل فاتورة شراء من مورد",
    description:
      "إضافة الأصناف المشتراة وأسعارها، وتحديث المخزون وحساب المورد.",
    youtubeUrl: "",
    category: "purchases",
  },
  {
    id: "purchases-list",
    title: "سجل المشتريات وتفاصيل الفاتورة",
    description:
      "البحث في فواتير الشراء وتصفيتها حسب المورد والتاريخ، وعرض تفاصيلها.",
    youtubeUrl: "",
    category: "purchases",
  },
  {
    id: "purchase-returns",
    title: "مرتجع المشتريات",
    description: "إرجاع بضاعة للمورد وخصمها من المخزون ومن رصيده.",
    youtubeUrl: "",
    category: "purchases",
  },
  {
    id: "purchase-orders",
    title: "طلبات الشراء واقتراحات إعادة الطلب",
    description:
      "طلب شراء جاهز بالأصناف التي قاربت على النفاد مجمّعة حسب المورد.",
    youtubeUrl: "",
    category: "purchases",
  },

  // ---------- العملاء والموردون ----------
  {
    id: "customers",
    title: "إضافة العملاء وإدارتهم",
    description:
      "بيانات العميل، والبحث والتصفية، ومعرفة المتأخرين ومن بلغوا حدهم.",
    youtubeUrl: "",
    category: "contacts",
  },
  {
    id: "credit-sales",
    title: "البيع الآجل والحد الائتماني",
    description: "البيع للعميل بالآجل، وضبط الحد الأقصى لدينه ومتابعته.",
    youtubeUrl: "",
    category: "contacts",
  },
  {
    id: "installments",
    title: "البيع بالتقسيط ومتابعة الأقساط",
    description:
      "إنشاء خطة تقسيط بمقدّم وعدد أقساط ودوريتها، وتحصيل الأقساط ومتابعة المتأخر منها.",
    youtubeUrl: "",
    category: "contacts",
    featured: true,
  },
  {
    id: "collections",
    title: "تحصيل الديون من العملاء",
    description: "تسجيل دفعات العملاء وأثرها على الرصيد والخزنة.",
    youtubeUrl: "",
    category: "contacts",
  },
  {
    id: "customer-statement",
    title: "كشف حساب العميل وإرساله على واتساب",
    description: "مراجعة كشف الحساب لفترة محددة، وحفظه PDF أو إرساله للعميل.",
    youtubeUrl: "",
    category: "contacts",
  },
  {
    id: "suppliers",
    title: "إضافة الموردين وإدارتهم",
    description: "بيانات المورد، والبحث في الموردين، ومعرفة المستحق لكل منهم.",
    youtubeUrl: "",
    category: "contacts",
  },
  {
    id: "supplier-payments",
    title: "دفعات الموردين وكشف حسابهم",
    description: "تسجيل ما دفعته للمورد، ومراجعة كشف حسابه بالتفصيل.",
    youtubeUrl: "",
    category: "contacts",
  },

  // ---------- الخزنة والمصروفات ----------
  {
    id: "dashboard",
    title: "قراءة الشاشة الرئيسية",
    description:
      "مبيعات اليوم وصافي الربح، والتنبيهات، والإجراءات السريعة في نظرة واحدة.",
    youtubeUrl: "",
    category: "finance",
  },
  {
    id: "expenses",
    title: "تسجيل المصروفات اليومية",
    description:
      "الإيجار والكهرباء والرواتب وغيرها، مع البحث والتصفية حسب البند والتاريخ.",
    youtubeUrl: "",
    category: "finance",
  },
  {
    id: "treasury",
    title: "الخزنة والحركات اليدوية",
    description: "قراءة رصيد الخزنة وحركاتها، وتسجيل إيداع أو سحب يدوي.",
    youtubeUrl: "",
    category: "finance",
  },

  // ---------- التقارير ----------
  {
    id: "reports-sales",
    title: "تقرير المبيعات والأرباح",
    description:
      "صافي المبيعات ومجمل الربح وعدد الفواتير لأي فترة، بالرسم البياني.",
    youtubeUrl: "",
    category: "reports",
    featured: true,
  },
  {
    id: "reports-products",
    title: "تقرير الأصناف والأقسام",
    description: "الأكثر مبيعاً والأعلى ربحاً والأقل حركة، وأداء كل قسم.",
    youtubeUrl: "",
    category: "reports",
  },
  {
    id: "reports-stock",
    title: "تقارير النواقص والراكد والمشتريات",
    description: "ما يجب شراؤه، وما لا يتحرك، وما اشتريته من كل مورد.",
    youtubeUrl: "",
    category: "reports",
  },
  {
    id: "reports-people",
    title: "تقارير العملاء والكاشيرية والمديونيات",
    description:
      "أفضل العملاء ونقاطهم، وأداء كل كاشير وورديته، والديون المستحقة.",
    youtubeUrl: "",
    category: "reports",
  },
  {
    id: "reports-treasury",
    title: "تقارير الخزنة والعروض والمرتجعات",
    description: "حركة الأموال، وأثر كل عرض على المبيعات، وأسباب المرتجعات.",
    youtubeUrl: "",
    category: "reports",
  },
  {
    id: "reports-export",
    title: "تصدير التقارير PDF وExcel",
    description: "حفظ أي تقرير أو طباعته لمشاركته مع شريك أو محاسب.",
    youtubeUrl: "",
    category: "reports",
  },
  {
    id: "audit-log",
    title: "سجل العمليات: من فعل ماذا ومتى",
    description:
      "متابعة كل تعديل وحذف في البرنامج باسم المستخدم ووقته وتفاصيل التغيير.",
    youtubeUrl: "",
    category: "reports",
  },

  // ---------- الإعدادات والطباعة ----------
  {
    id: "shop-settings",
    title: "بيانات المحل والعملة",
    description:
      "اسم المحل الذي يظهر في الإيصال وواتساب، وعملة الأسعار والتقارير.",
    youtubeUrl: "",
    category: "settings",
  },
  {
    id: "tax",
    title: "ضريبة القيمة المضافة",
    description:
      "تفعيل الضريبة للمحل المسجل، وأثرها على الفاتورة والإيصال والتقارير.",
    youtubeUrl: "",
    category: "settings",
  },
  {
    id: "payment-methods",
    title: "إعداد طرق الدفع",
    description:
      "المحافظ والبطاقات والتحويلات التي تقبلها، ورقم الحساب الظاهر للكاشير.",
    youtubeUrl: "",
    category: "settings",
  },
  {
    id: "printer",
    title: "ضبط الطابعة الحرارية أو A4",
    description: "اختيار الطابعة ومقاس الورق على كل جهاز، وطباعة إيصال تجريبي.",
    youtubeUrl: "",
    category: "settings",
  },
  {
    id: "receipt-design",
    title: "تصميم شكل الفاتورة",
    description:
      "الشعار والعنوان والتليفون ورسالة الشكر، ومعاينة الإيصال قبل الحفظ.",
    youtubeUrl: "",
    category: "settings",
  },
  {
    id: "backup",
    title: "النسخ الاحتياطي واستعادة البيانات",
    description:
      "النسخ التلقائي، واختيار مكان الحفظ كفلاشة، واسترجاع نسخة سابقة.",
    youtubeUrl: "",
    category: "settings",
  },
  {
    id: "appearance-updates",
    title: "شكل البرنامج والتحديثات",
    description:
      "الوضع الفاتح والغامق، وتحديث البرنامج لأحدث إصدار مع بقاء بياناتك.",
    youtubeUrl: "",
    category: "settings",
  },
  {
    id: "plans",
    title: "الخطط والترقية وتفعيل الترخيص",
    description:
      "معرفة خطتك الحالية، والترقية، وتفعيل مفتاح الترخيص على الجهاز.",
    youtubeUrl: "",
    category: "settings",
  },

  // ---------- الأجهزة والفروع ----------
  {
    id: "cashier-devices",
    title: "ربط أجهزة كاشير إضافية في المحل",
    description:
      "تشغيل الشبكة على الجهاز الأساسي، وربط جهاز كاشير آخر يبيع على البيانات نفسها.",
    youtubeUrl: "",
    category: "devices",
  },
  {
    id: "branches",
    title: "ربط الفروع بسيرفر الفروع",
    description:
      "تسجيل المحل وإضافة الفروع، وربط كل فرع ومزامنة الأصناف بينها.",
    youtubeUrl: "",
    category: "devices",
  },
  {
    id: "transfers",
    title: "تحويل البضاعة بين الفروع",
    description: "إرسال بضاعة لفرع آخر، واستلامها هناك، ومتابعة حالة كل تحويل.",
    youtubeUrl: "",
    category: "devices",
  },
  {
    id: "mobile-app",
    title: "تطبيق الهاتف لمتابعة الفروع",
    description:
      "متابعة المبيعات والمخزون والتنبيهات والتحويلات لكل الفروع من هاتفك.",
    youtubeUrl: "",
    category: "devices",
  },

  // ---------- المتجر الإلكتروني ----------
  {
    id: "online-store",
    title: "إنشاء متجرك الإلكتروني واستقبال الطلبات",
    description:
      "تفعيل المتجر ورابطه، واختيار الأصناف المعروضة، واستقبال الطلبات بالدفع عند الاستلام.",
    youtubeUrl: "",
    category: "online-store",
    featured: true,
  },

  // ---------- الإيصال الإلكتروني ----------
  {
    id: "eta-readiness",
    title: "تجهيز الإيصال الإلكتروني وتفعيله",
    description:
      "قائمة الجاهزية وما ينقص قبل التفعيل، وبيئة التجربة والتشغيل الفعلي.",
    youtubeUrl: "",
    category: "e-receipt",
  },
  {
    id: "eta-shop",
    title: "بيانات المحل والفرع في المنظومة",
    description:
      "رقم التسجيل الضريبي والاسم التجاري وكود النشاط، وكود الفرع وعنوانه.",
    youtubeUrl: "",
    category: "e-receipt",
  },
  {
    id: "eta-devices-units",
    title: "أجهزة الإيصال ووحدات القياس",
    description:
      "الرقم التسلسلي وبيانات الدخول لكل جهاز، وكود كل وحدة بيع في المنظومة.",
    youtubeUrl: "",
    category: "e-receipt",
  },
  {
    id: "eta-sending",
    title: "إرسال الإيصالات ومتابعة حالتها",
    description: "حالة كل إيصال، والإرسال الآن، ومعالجة الإيصالات المرفوضة.",
    youtubeUrl: "",
    category: "e-receipt",
  },
];

/** شرح جاهز للعرض: معرّف الفيديو مستخرج (null = لم يُنشر بعد)، ورقمه داخل قسمه. */
export interface ResolvedTutorial extends Tutorial {
  videoId: string | null;
  /** ترتيب الشرح داخل قسمه (1، 2، 3…). */
  lesson: number;
}

const categoryOrder = new Map(TUTORIAL_CATEGORIES.map((c, i) => [c.id, i]));

/** كل الشروحات مرتبة حسب القسم ثم ترتيب التعلّم. رقم الدرس ثابت سواء نُشر الفيديو أم لا. */
export const RESOLVED_TUTORIALS: ResolvedTutorial[] = (() => {
  const counters = new Map<TutorialCategoryId, number>();
  return TUTORIALS.map((t) => {
    const lesson = (counters.get(t.category) ?? 0) + 1;
    counters.set(t.category, lesson);
    return { ...t, videoId: getYoutubeId(t.youtubeUrl), lesson };
  }).sort(
    (a, b) =>
      (categoryOrder.get(a.category) ?? 0) -
      (categoryOrder.get(b.category) ?? 0),
  );
})();

/** الشروحات التي لها فيديو منشور فعلاً. */
export const PUBLISHED_TUTORIALS = RESOLVED_TUTORIALS.filter(
  (t) => t.videoId !== null,
);

/** معرّفات فيديوهات يوتيوب المنشورة (لجلب المدد وقت البناء). */
export const PUBLISHED_VIDEO_IDS = PUBLISHED_TUTORIALS.map(
  (t) => t.videoId as string,
);

export const CATEGORY_BY_ID = new Map(
  TUTORIAL_CATEGORIES.map((c) => [c.id, c]),
);

export function tutorialsIn(category: TutorialCategoryId): ResolvedTutorial[] {
  return RESOLVED_TUTORIALS.filter((t) => t.category === category);
}

/** المختارات للرئيسية: المنشور منها أولاً حتى لا تتصدر بطاقات «قريباً». */
export const FEATURED_TUTORIALS = RESOLVED_TUTORIALS.filter(
  (t) => t.featured,
).sort((a, b) => Number(a.videoId === null) - Number(b.videoId === null));

/** «شرح واحد / شرحان / 5 شروح / 24 شرحًا» حسب قواعد العدد في العربية. */
export function lessonsLabel(n: number): string {
  if (n === 1) return "شرح واحد";
  if (n === 2) return "شرحان";
  if (n >= 3 && n <= 10) return `${n} شروح`;
  return `${n} شرحًا`;
}
