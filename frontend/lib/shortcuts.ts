export interface Shortcut {
  label: string;
  description: string;
  match: (event: KeyboardEvent) => boolean;
}

interface Modifiers {
  ctrl?: boolean; // Ctrl أو ⌘
  alt?: boolean;
  shift?: boolean;
}

/**
 * يطابق الاختصار بـ event.code ليعمل مع لوحة المفاتيح العربية.
 * الـ modifiers مطابقة بالضبط: أي مفتاح زائد يلغي الاختصار.
 */
function combo(codes: string | string[], mods: Modifiers = {}) {
  const list = Array.isArray(codes) ? codes : [codes];
  return (event: KeyboardEvent) =>
    list.includes(event.code) &&
    (event.ctrlKey || event.metaKey) === Boolean(mods.ctrl) &&
    event.altKey === Boolean(mods.alt) &&
    event.shiftKey === Boolean(mods.shift);
}

/** مفتاح بدون أي modifier، مثل F2. */
export const plain = (code: string | string[]) => combo(code);

/** Ctrl/⌘ + مفتاح. */
export const ctrl = (code: string | string[]) => combo(code, { ctrl: true });

/** Alt + مفتاح. */
export const alt = (code: string | string[]) => combo(code, { alt: true });

/** Enter العادي ولوحة الأرقام. */
export const ENTER = ["Enter", "NumpadEnter"];
