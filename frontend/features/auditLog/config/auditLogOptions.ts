export const ENTITY_LABEL: Record<string, string> = {
  product: "صنف",
  customer: "عميل",
  supplier: "مورد",
  user: "مستخدم",
  expense: "مصروف",
  cash_entry: "حركة خزنة",
  sale: "فاتورة بيع",
  purchase: "فاتورة شراء",
  shift: "وردية",
  shop: "المحل",
  backup: "نسخة احتياطية",
};

export const ACTION_LABEL: Record<string, string> = {
  create: "إضافة",
  update: "تعديل",
  delete: "حذف",
  toggle_active: "تفعيل/تعطيل",
  duplicate: "نسخ",
  stock_adjust: "تعديل مخزون",
  collect_payment: "تحصيل دفعة",
  payment: "سداد",
  return: "مرتجع",
  open: "فتح",
  close: "قفل",
  rename: "تغيير الاسم",
  price_from_purchase: "سعر من الشراء",
  login: "تسجيل دخول",
  reset_password: "إعادة كلمة المرور",
  change_password: "تغيير كلمة المرور",
};

/** عمليات تُبرز بالأحمر لأنها تغيّر بيانات حساسة أو تحذفها. */
export const DANGER_ACTIONS: ReadonlySet<string> = new Set([
  "delete",
  "stock_adjust",
  "return",
]);

/** العمليات المتاحة في فلتر "العملية" (الأكثر أهمية فقط). */
const FILTERABLE_ACTIONS = [
  "create",
  "update",
  "delete",
  "stock_adjust",
  "return",
  "collect_payment",
  "close",
];

export const ALL = "all";

export const ENTITY_OPTIONS = [
  { value: ALL, label: "كل الأنواع" },
  ...Object.entries(ENTITY_LABEL).map(([value, label]) => ({ value, label })),
];

export const ACTION_OPTIONS = [
  { value: ALL, label: "كل العمليات" },
  ...FILTERABLE_ACTIONS.map((a) => ({ value: a, label: ACTION_LABEL[a] })),
];

export const AUDIT_PAGE_SIZES = [25, 50, 100];
export const AUDIT_DEFAULT_PAGE_SIZE = 50;
