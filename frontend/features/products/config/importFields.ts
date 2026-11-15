export type ImportFieldKey =
  | "name"
  | "barcode"
  | "category"
  | "unit"
  | "costPrice"
  | "salePrice"
  | "stock"
  | "minStock"
  | "scaleCode"
  | "wholesalePrice"
  | "taxType"
  | "taxRate"
  | "etaItemType"
  | "etaItemCode";

export interface ImportField {
  key: ImportFieldKey;
  label: string;
  required: boolean;
  /** كلمات لو ظهرت في اسم عمود Excel نربطه تلقائياً بهذا الحقل. */
  aliases: string[];
}

/** حقول الصنف في التطبيق اللي ممكن يتربط بها عمود من Excel. */
export const IMPORT_FIELDS: ImportField[] = [
  {
    key: "name",
    label: "اسم الصنف",
    required: true,
    aliases: ["اسم", "صنف", "name", "product"],
  },
  // الإيصال الإلكتروني: قبل «الباركود» (فيها كلمة «كود»)، و«نوع كود المنظومة» قبل «كود المنظومة».
  {
    key: "etaItemType",
    label: "نوع كود المنظومة (EGS/GS1)",
    required: false,
    aliases: ["نوع كود المنظومة", "item type", "itemtype"],
  },
  {
    key: "etaItemCode",
    label: "كود المنظومة",
    required: false,
    aliases: ["كود المنظومة", "item code", "itemcode", "egs", "gs1"],
  },
  // قبل «الباركود»: الربط التلقائي بالترتيب، و«كود الميزان» يحتوي كلمة «كود».
  {
    key: "scaleCode",
    label: "كود الميزان",
    required: false,
    aliases: ["ميزان", "plu", "scale"],
  },
  // ضريبة القيمة المضافة: «نوع الضريبة» قبل «نسبة الضريبة» (الثاني يطابق كلمة «ضريبة» فقط).
  {
    key: "taxType",
    label: "نوع الضريبة",
    required: false,
    aliases: ["نوع الضريبة", "المعاملة الضريبية", "tax type", "tax_type"],
  },
  {
    key: "taxRate",
    label: "نسبة الضريبة %",
    required: false,
    aliases: ["ضريبة", "الضريبة", "vat", "tax"],
  },
  // قبل «سعر البيع»: عمود «سعر الجملة» فيه كلمة «سعر» أيضاً.
  {
    key: "wholesalePrice",
    label: "سعر الجملة",
    required: false,
    aliases: ["جملة", "wholesale"],
  },
  {
    key: "barcode",
    label: "الباركود",
    required: false,
    aliases: ["باركود", "كود", "barcode", "code"],
  },
  {
    key: "category",
    label: "القسم",
    required: false,
    aliases: ["قسم", "تصنيف", "category"],
  },
  { key: "unit", label: "الوحدة", required: false, aliases: ["وحدة", "unit"] },
  {
    key: "costPrice",
    label: "سعر الشراء",
    required: false,
    aliases: ["شراء", "تكلفة", "cost"],
  },
  {
    key: "salePrice",
    label: "سعر البيع",
    required: true,
    aliases: ["بيع", "سعر", "price"],
  },
  {
    key: "stock",
    label: "الرصيد الحالي",
    required: false,
    aliases: ["كمية", "رصيد", "مخزون", "qty", "stock"],
  },
  {
    key: "minStock",
    label: "الحد الأدنى",
    required: false,
    aliases: ["حد", "min"],
  },
];

export const IGNORE = "none";
export type MappingValue = ImportFieldKey | typeof IGNORE;

/** عمود Excel ← حقل في التطبيق (أو تجاهل). */
export type ColumnMapping = Record<string, MappingValue>;

/** ربط تلقائي ذكي بناءً على أسماء الأعمدة، والمستخدم يعدّل بعده. */
export function autoMapColumns(columns: string[]): ColumnMapping {
  const mapping: ColumnMapping = Object.fromEntries(
    columns.map((column) => [column, IGNORE]),
  );
  const used = new Set<string>();

  for (const field of IMPORT_FIELDS) {
    const column = columns.find(
      (c) =>
        !used.has(c) &&
        field.aliases.some((alias) => c.toLowerCase().includes(alias)),
    );
    if (column) {
      mapping[column] = field.key;
      used.add(column);
    }
  }
  return mapping;
}
