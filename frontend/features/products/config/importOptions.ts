import { IGNORE, IMPORT_FIELDS } from "./importFields";

export type ImportStep = "file" | "map" | "done";
export type DuplicateMode = "update" | "skip";

export const IMPORT_STEPS: { id: ImportStep; label: string }[] = [
  { id: "file", label: "اختيار الملف" },
  { id: "map", label: "ربط الأعمدة" },
  { id: "done", label: "تم" },
];

export const DUPLICATE_MODES: { id: DuplicateMode; label: string }[] = [
  { id: "update", label: "تحديث الصنف الموجود" },
  { id: "skip", label: "تخطي وعدم تغييره" },
];

/** خيارات قائمة "يقابله في البرنامج" لكل عمود. */
export const IMPORT_FIELD_ITEMS = [
  { value: IGNORE, label: "تجاهل هذا العمود" },
  ...IMPORT_FIELDS.map((f) => ({
    value: f.key,
    label: f.required ? `${f.label} *` : f.label,
  })),
];

export const SHEET_ACCEPT = ".xlsx,.xls,.csv";
export const SHEET_PATTERN = /\.(xlsx|xls|csv)$/i;
