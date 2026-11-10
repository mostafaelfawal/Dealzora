import JsBarcode from "jsbarcode";

import { currencySymbol } from "@/lib/currency";
import { formatNumber } from "@/lib/format";
import { printHtml } from "@/lib/print";

import { getLabelSize, type LabelPrefs } from "../config/barcodeLabel";

export interface LabelData {
  name: string;
  barcode: string;
  price: number;
  /** اسم الوحدة لو مش الأساسية (كرتونة، علبة…). */
  unitName?: string;
}

const esc = (text: string) =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** EAN/UPC لو الرقم صالح بخانة التحقق، وإلا CODE128 (يقبل أي نص). */
function pickFormat(value: string): string {
  if (/^\d{13}$/.test(value)) return "EAN13";
  if (/^\d{8}$/.test(value)) return "EAN8";
  if (/^\d{12}$/.test(value)) return "UPC";
  return "CODE128";
}

/**
 * يرسم الباركود كـ SVG (خطوط فقط، الأرقام نكتبها بالـ HTML تحتها).
 * الرسم الشعاعي يطلع حاد على أي دقة طابعة (203/300 dpi).
 */
export function renderBarcodeSvg(value: string): string | null {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const base = { displayValue: false, margin: 0, width: 2, height: 60 };
  let valid = false;
  const draw = (format: string) =>
    JsBarcode(svg, value, {
      ...base,
      format,
      flat: true,
      valid: (ok) => {
        valid = ok;
      },
    });
  try {
    draw(pickFormat(value));
    if (!valid) draw("CODE128");
  } catch {
    return null;
  }
  if (!valid) return null;
  // يتمدد أفقياً ليملأ عرض الملصق مع الحفاظ على نسب الخطوط.
  svg.setAttribute("preserveAspectRatio", "none");
  svg.removeAttribute("style");
  return svg.outerHTML;
}

function labelMarkup(data: LabelData, prefs: LabelPrefs, shopName: string) {
  const svg = renderBarcodeSvg(data.barcode) ?? "";
  const name = data.unitName ? `${data.name} - ${data.unitName}` : data.name;
  return `<div class="label">
  ${prefs.showShop && shopName ? `<div class="shop">${esc(shopName)}</div>` : ""}
  ${prefs.showName ? `<div class="name">${esc(name)}</div>` : ""}
  <div class="bars">${svg}</div>
  <div class="foot${prefs.showPrice ? "" : " center"}">
    <span class="code">${esc(data.barcode)}</span>
    ${prefs.showPrice ? `<span class="price">${formatNumber(data.price)} ${currencySymbol()}</span>` : ""}
  </div>
</div>`;
}

/** مستند HTML مستقل: كل ملصق صفحة بمقاس الملصق بالضبط (بدون خطوط خارجية). */
export function buildLabelsHtml(
  data: LabelData,
  prefs: LabelPrefs,
  shopName: string,
  copies: number,
): string {
  const { width, height } = getLabelSize(prefs.size);
  // الخط يصغر مع الملصقات الصغيرة.
  const fs = height <= 20 ? 7 : height <= 25 ? 8 : 9;
  const one = labelMarkup(data, prefs, shopName);

  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<title>باركود ${esc(data.barcode)}</title>
<style>
  @page { size: ${width}mm ${height}mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${width}mm; background: #fff; color: #000;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font: ${fs}pt/1.15 Tahoma, "Segoe UI", Arial, sans-serif; }
  .label { width: ${width}mm; height: ${height}mm; padding: 1.2mm 2mm;
    display: flex; flex-direction: column; gap: 0.4mm; overflow: hidden;
    page-break-after: always; break-after: page; }
  .label:last-child { page-break-after: auto; break-after: auto; }
  .shop { font-size: ${fs - 1}pt; text-align: center; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; }
  .name { font-weight: bold; text-align: center; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; }
  .bars { flex: 1; min-height: 0; }
  .bars svg { display: block; width: 100%; height: 100%; shape-rendering: crispEdges; }
  .foot { display: flex; justify-content: space-between; align-items: baseline;
    gap: 1mm; white-space: nowrap; }
  .foot.center { justify-content: center; }
  .code { direction: ltr; font-family: Consolas, "Courier New", monospace;
    letter-spacing: 0.3px; font-size: ${fs - 0.5}pt; }
  .price { font-weight: bold; font-size: ${fs + 1}pt; direction: rtl; }
</style></head><body>${one.repeat(copies)}</body></html>`;
}

export function printLabels(
  data: LabelData,
  prefs: LabelPrefs,
  shopName: string,
  copies: number,
) {
  printHtml(buildLabelsHtml(data, prefs, shopName, copies));
}
