export interface Shortcut {
  /** النص اللي يظهر على الزر. */
  label: string;
  match: (event: KeyboardEvent) => boolean;
}

/**
 * بنستخدم `event.code` بدل `event.key` للحروف عشان الاختصار يشتغل
 * حتى لو لوحة المفاتيح عربي.
 */
export const SHORTCUTS = {
  newSale: {
    label: "F1",
    match: (e) => e.key === "F1",
  },
  globalSearch: {
    label: "Ctrl K",
    match: (e) => (e.ctrlKey || e.metaKey) && e.code === "KeyK",
  },
} satisfies Record<string, Shortcut>;
