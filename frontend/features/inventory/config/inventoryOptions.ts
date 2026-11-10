import { plain, type Shortcut } from "@/lib/shortcuts";

import type {
  AdjustReason,
  InventoryTab,
  MovementType,
} from "../types/inventory";

export const STAGNANT_DAYS_OPTIONS = [
  { value: "30", label: "راكد 30 يوماً" },
  { value: "60", label: "راكد 60 يوماً" },
  { value: "90", label: "راكد 90 يوماً" },
] as const;

export const INVENTORY_TABS: { id: InventoryTab; label: string }[] = [
  { id: "all", label: "كل الأصناف" },
  { id: "low", label: "قارب على النفاد" },
  { id: "out", label: "نفد" },
  { id: "stagnant", label: "راكد" },
];

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  opening: "رصيد افتتاحي",
  purchase: "شراء",
  purchase_return: "مرتجع شراء",
  sale: "بيع",
  sale_return: "مرتجع بيع",
  count: "جرد",
  damage: "تالف",
  gift: "هدية",
  adjustment: "تسوية",
};

export const ADJUST_REASONS: {
  id: AdjustReason;
  label: string;
  /** ماذا تعني الكمية لكل سبب. */
  qtyLabel: string;
  hint: string;
}[] = [
  {
    id: "count",
    label: "جرد",
    qtyLabel: "الرصيد الفعلي بعد العدّ",
    hint: "اكتب الكمية الموجودة فعلاً على الرف، والنظام يحسب الفرق.",
  },
  {
    id: "damage",
    label: "تالف",
    qtyLabel: "الكمية التالفة",
    hint: "تخرج من المخزون وتظهر في حركة الصنف كتالف.",
  },
  {
    id: "gift",
    label: "هدية",
    qtyLabel: "الكمية المهداة",
    hint: "تخرج من المخزون بدون بيع.",
  },
  {
    id: "other",
    label: "أخرى",
    qtyLabel: "الفرق (+ للزيادة، − للنقص)",
    hint: "اكتب السبب في الملاحظة (إلزامي).",
  },
];

export const INVENTORY_SHORTCUTS = {
  adjust: {
    label: "F4",
    description: "تعديل مخزون الصنف المحدد",
    match: plain("F4"),
  },
} satisfies Record<string, Shortcut>;

export const INVENTORY_PAGE_SIZES = [24, 48, 96];
export const DEFAULT_STAGNANT_DAYS = "30";
export const INVENTORY_SEARCH_DEBOUNCE_MS = 300;
export const LEDGER_PAGE_SIZE = 20;
