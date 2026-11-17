/**
 * يُنفَّذ أثناء تحليل HTML قبل تحميل React: يخفي الصفحة التعريفية "/" إن كنا داخل Tauri.
 * نفس الفحص الذي يجريه isTauri() من @tauri-apps/api/core (globalThis.isTauri يحقنه Tauri قبل أي سكربت).
 * يُحمَّل من التخطيط الجذري عبر next/script (beforeInteractive) فيعمل في كل الصفحات، لذا نقيّده بالمسار.
 */
export const HIDE_IN_DESKTOP = `if(globalThis.isTauri&&/^\\/(index\\.html)?$/.test(location.pathname)){document.documentElement.style.visibility="hidden"}`;
