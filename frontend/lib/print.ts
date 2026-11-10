/**
 * يطبع مستند HTML مستقل عبر iframe مخفي (نافذة الطباعة الأصلية للنظام،
 * تشمل الطابعة الحرارية وطابعة الملصقات). مقاس الورق يحدده @page داخل المستند.
 */
export function printHtml(html: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;opacity:0;";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc || !frame.contentWindow) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  const win = frame.contentWindow;
  const cleanup = () => setTimeout(() => frame.remove(), 1000);
  win.addEventListener("afterprint", cleanup, { once: true });
  // ننتظر رسم الصفحة قبل الطباعة.
  setTimeout(() => {
    win.focus();
    win.print();
    cleanup();
  }, 50);
}
