import { ctrl, ENTER, plain, type Shortcut } from "@/lib/shortcuts";

/** اختصارات صفحة المستخدمين. (F1 محجوز لـ "بيع جديد" في الـ Header.) */
export const USERS_SHORTCUTS = {
  focusSearch: {
    label: "F2",
    description: "البحث عن مستخدم",
    match: plain("F2"),
  },
  newUser: {
    label: "F4",
    description: "إضافة مستخدم جديد",
    match: plain("F4"),
  },
  toggleView: {
    label: "F6",
    description: "التبديل بين البطاقات والجدول",
    match: plain("F6"),
  },
} as const satisfies Record<string, Shortcut>;

/** اختصارات صفحة إضافة/تعديل مستخدم. */
export const USER_FORM_SHORTCUTS = {
  save: {
    label: "Ctrl+S",
    description: "حفظ المستخدم",
    match: ctrl("KeyS"),
  },
  saveAndNew: {
    label: "Ctrl+Enter",
    description: "حفظ وإضافة مستخدم آخر",
    match: ctrl(ENTER),
  },
} as const satisfies Record<string, Shortcut>;