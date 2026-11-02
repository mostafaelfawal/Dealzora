/**
 * خانة الباركود عنصر DOM وليست state، فمكانها هنا وليس في Redux.
 * أي مكان في الشاشة يقدر يرجّع التركيز لها بدون تمرير ref بين المكوّنات.
 */
let searchInput: HTMLInputElement | null = null;

/** ref callback: يتحط على خانة الباركود. */
export function registerSearchInput(element: HTMLInputElement | null) {
  searchInput = element;
}

/** التركيز التلقائي للفأرة ولوحة المفاتيح فقط. على اللمس يفتح الكيبورد الافتراضي فنتجنبه. */
export const hasFinePointer = () =>
  typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;

export function focusSearch(force = false) {
  if (!force && !hasFinePointer()) return;
  searchInput?.focus();
}

export function selectSearchText() {
  searchInput?.select();
}
