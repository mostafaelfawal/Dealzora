/**
 * يرسم مستند HTML مستقل (مثل الإيصال) كصورة بعرض رأس الطابعة الحرارية بالنقاط.
 *
 * الطريقة: نخطط الصفحة في iframe مخفي بعرض الورق القابل للطباعة لنعرف طولها، ثم نضع
 * نفس المستند داخل SVG (foreignObject) ونرسمه على canvas. المتصفح نفسه هو من يرسم،
 * فالعربي والاتجاه والخطوط تطلع مطابقة تماماً للمعاينة، وبدون أي مكتبة خارجية.
 */

import type { PaperWidth } from "./printerPrefs";

/** عرض رأس الطباعة بالنقاط (203 dpi) والمساحة القابلة للطباعة بالمليمتر. */
const PAPER: Record<PaperWidth, { dots: number; printableMm: number }> = {
  80: { dots: 576, printableMm: 72 },
  58: { dots: 384, printableMm: 48 },
};

const MM_TO_CSS_PX = 96 / 25.4;
/** أقصى طول للإيصال بالنقاط (حد آمن لحجم الـ canvas). */
const MAX_HEIGHT_DOTS = 30_000;

/** px (CSS) لكل نقطة طابعة: نفس معامل التحويل في renderHtmlToCanvas (لرسم QR بنقاط صحيحة). */
export function cssPxPerDot(paperMm: PaperWidth): number {
  const { dots, printableMm } = PAPER[paperMm];
  return Math.round(printableMm * MM_TO_CSS_PX) / dots;
}

const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export async function renderHtmlToCanvas(
  html: string,
  paperMm: PaperWidth,
): Promise<HTMLCanvasElement> {
  const { dots, printableMm } = PAPER[paperMm];
  const cssWidth = Math.round(printableMm * MM_TO_CSS_PX);

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${cssWidth}px;height:10px;border:0;visibility:hidden;`;
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument;
    if (!doc) throw new Error("تعذّر تجهيز الإيصال للطباعة");
    doc.open();
    doc.write(html);
    doc.close();

    // عرض الورق القابل للطباعة بدل عرض الصفحة المكتوب للطباعة العادية.
    const fit = doc.createElement("style");
    fit.textContent = `html,body{width:${cssWidth}px!important;margin:0!important;background:#fff!important;}body{box-sizing:border-box!important;padding:1mm 1mm 2mm!important;}`;
    doc.head.appendChild(fit);

    await doc.fonts?.ready;
    await nextFrame();
    await nextFrame();
    const cssHeight = Math.ceil(
      Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight),
    );

    const markup = new XMLSerializer().serializeToString(doc.documentElement);
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${cssWidth}" height="${cssHeight}">` +
      `<foreignObject x="0" y="0" width="100%" height="100%">${markup}</foreignObject></svg>`;

    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await img.decode();

    const scale = dots / cssWidth;
    const canvas = document.createElement("canvas");
    canvas.width = dots;
    canvas.height = Math.min(Math.ceil(cssHeight * scale), MAX_HEIGHT_DOTS);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("تعذّر تجهيز صورة الإيصال");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // SVG متجه: يُرسم مباشرة بدقة الطابعة فتطلع الحروف حادة.
    ctx.drawImage(img, 0, 0, dots, cssHeight * scale);
    return canvas;
  } finally {
    frame.remove();
  }
}
