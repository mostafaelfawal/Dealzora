/**
 * جدول ميزات الخطط بلا أي اعتماد على الشبكة أو React، ليُستورد من مكونات الخادم أيضاً
 * (الصفحة التعريفية). lib/plan.ts يعيد تصديره كما هو.
 */
export type PlanFeature =
  | "customers"
  | "wallets"
  | "suppliers"
  | "expenses"
  | "extra_units"
  | "barcode_labels"
  | "excel"
  | "whatsapp"
  | "backup_location"
  | "audit_log"
  | "full_reports"
  | "multi_user"
  | "terminals"
  | "expiry"
  | "branches"
  | "e_receipt"
  | "scale_barcode"
  | "promotions"
  | "wholesale"
  | "purchase_orders"
  | "loyalty"
  | "statement_pdf"
  | "installments";

/**
 * اسم الميزة في رسالة الترقية + أقل خطة تفتحها (نفس _UNLOCKED_IN في backend/app/core/plan.py،
 * ونفس ترتيب صفحة الخطط features/settings/config/plans.ts).
 */
export const FEATURE_INFO: Record<PlanFeature, { name: string; plan: string }> =
  {
    customers: { name: "العملاء والبيع الآجل", plan: "دُكّان" },
    wallets: {
      name: "الدفع الإلكتروني (محافظ وبطاقات وتحويلات)",
      plan: "دُكّان",
    },
    suppliers: { name: "الموردين والمشتريات", plan: "دُكّان" },
    expenses: { name: "المصروفات والخزنة", plan: "دُكّان" },
    extra_units: { name: "وحدات البيع الإضافية (كرتونة/دستة)", plan: "دُكّان" },
    barcode_labels: { name: "طباعة ملصقات الباركود", plan: "دُكّان" },
    excel: { name: "الاستيراد والتصدير من Excel", plan: "دُكّان" },
    whatsapp: { name: "إرسال الفاتورة على واتساب", plan: "دُكّان" },
    backup_location: {
      name: "اختيار مكان النسخ والاستعادة من ملف",
      plan: "دُكّان",
    },
    audit_log: { name: "سجل العمليات", plan: "سوق" },
    full_reports: { name: "التقارير الكاملة", plan: "دُكّان" },
    multi_user: { name: "أكثر من مستخدم", plan: "دُكّان" },
    terminals: { name: "أجهزة كاشير إضافية", plan: "سوق" },
    expiry: { name: "تتبع الصلاحية والدفعات", plan: "سوق" },
    e_receipt: { name: "الإيصال الإلكتروني - منظومة الضرائب", plan: "سوق" },
    scale_barcode: { name: "باركود الميزان", plan: "سوق" },
    promotions: { name: "العروض التلقائية", plan: "سوق" },
    wholesale: { name: "أسعار الجملة", plan: "سوق" },
    purchase_orders: { name: "طلبات الشراء من النواقص", plan: "سوق" },
    loyalty: { name: "نقاط الولاء", plan: "سوق" },
    statement_pdf: { name: "كشف حساب العميل PDF على واتساب", plan: "سوق" },
    installments: { name: "نظام التقسيط", plan: "سوق" },
    branches: { name: "تعدد الفروع وتحويل المخزون", plan: "سلسلة" },
  };
