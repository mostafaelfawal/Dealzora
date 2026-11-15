import { cssPxPerDot } from "@/lib/htmlRaster";
import type { PaperWidth } from "@/lib/printerPrefs";

import type { EtaPrint } from "../types/sale";

/**
 * QR الإيصال الإلكتروني ككود SVG بمقاس نقاط الطابعة الحرارية بالضبط.
 *
 * الطابعة 203 نقطة/بوصة (8 نقاط/مم). لو وقع حد مربع بين نقطتين يتشوّش بعد التحويل لأبيض/أسود،
 * فنجعل كل مربع (module) عدداً صحيحاً من النقاط، ونحسب الحجم بالـ CSS من نفس معامل التحويل
 * الذي يستخدمه htmlRaster. والنتيجة على الورق:
 *   58mm: 4 نقاط للمربع (0.5mm) · 80mm: 5 نقاط (0.625mm) لكود 53×53 (المحتوى المعتاد).
 * الهامش الصامت 4 مربعات (معيار QR) لتلتقطه كاميرا الموبايل بسهولة.
 */

const QUIET = 4;
/** أقصى عرض للكود بنقاط الطابعة (يترك هامشاً جانبياً مريحاً). */
const MAX_DOTS: Record<PaperWidth, number> = { 58: 300, 80: 340 };
/** أقل من 3 نقاط للمربع (0.375mm) يصعب على كاميرات الموبايل الضعيفة. */
const MIN_DOTS_PER_MODULE = 3;

export function qrDotsPerModule(modules: number, paperMm: PaperWidth): number {
  const total = modules + QUIET * 2;
  return Math.max(Math.floor(MAX_DOTS[paperMm] / total), MIN_DOTS_PER_MODULE);
}

/** SVG مستقل (نص) يصلح للإيصال المطبوع (HTML) وللمعاينة. */
export function qrSvg(rows: string[], paperMm: PaperWidth): string {
  const n = rows.length;
  const total = n + QUIET * 2;
  const dots = total * qrDotsPerModule(n, paperMm);
  const size = (dots * cssPxPerDot(paperMm)).toFixed(3);
  // كل صف: مستطيل واحد لكل تتابع مربعات داكنة (أصغر حجماً من مربع لكل خلية).
  let path = "";
  rows.forEach((row, y) => {
    let x = 0;
    while (x < n) {
      if (row[x] !== "1") {
        x++;
        continue;
      }
      let end = x;
      while (end < n && row[end] === "1") end++;
      path += `M${x + QUIET} ${y + QUIET}h${end - x}v1h-${end - x}z`;
      x = end;
    }
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${size}" height="${size}" ` +
    `shape-rendering="crispEdges" role="img" aria-label="QR الإيصال الإلكتروني">` +
    `<rect width="${total}" height="${total}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`
  );
}

const esc = (text: string) =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * كتلة «إيصال إلكتروني» أسفل الإيصال المطبوع. تُطبع فوراً حتى قبل الإرسال (الـ UUID محلي).
 * فاتورة بلا بيانات منظومة (الميزة متوقفة وقت البيع) لا تمر هنا أصلاً، فيبقى الإيصال كما كان.
 */
export function eReceiptBlockHtml(
  p: EtaPrint,
  paperMm: PaperWidth,
  kind: "sale" | "return",
): string {
  return `<hr>
  <div class="center tag">إيصال إلكتروني${kind === "return" ? " (مرتجع)" : ""}</div>
  <div class="center muted">${esc(p.tradeName)}</div>
  <div class="center muted">رقم التسجيل الضريبي: <b dir="ltr">${esc(p.rin)}</b></div>
  <div class="center muted">الفرع: <span dir="ltr">${esc(p.branchCode)}</span> · الجهاز: <span dir="ltr">${esc(p.deviceSerial)}</span></div>
  <div class="center muted">رقم الإيصال: <span dir="ltr">${esc(p.receiptNumber)}</span></div>
  <div class="qr">${qrSvg(p.qrModules, paperMm)}</div>
  <div class="uuid">${esc(p.uuid)}</div>
  ${p.referenceUuid ? `<div class="center muted">الفاتورة الأصلية:</div><div class="uuid">${esc(p.referenceUuid)}</div>` : ""}
  <div class="center muted">امسح الكود للتحقق على بوابة منظومة الإيصال الإلكتروني</div>`;
}

/** CSS الكتلة (يُضاف لمستند الإيصال فقط عند وجودها). */
export const E_RECEIPT_CSS = `
  .qr { text-align: center; margin: 4px 0 2px; line-height: 0; }
  .qr svg { display: inline-block; }
  .uuid { font: 9px/1.3 Consolas, "Courier New", monospace; direction: ltr; text-align: center; word-break: break-all; }`;
