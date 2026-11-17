import JsBarcode from "jsbarcode";

import { cssPxPerDot } from "@/lib/htmlRaster";
import type { PaperWidth } from "@/lib/printerPrefs";

/**
 * باركود خطي (Code128) برقم الفاتورة أسفل الإيصال: التاجر يمسحه بقارئ الباركود في بحث
 * الفواتير أو المرتجع فتظهر الفاتورة فوراً (البحث يقبل الرقم كما هو).
 *
 * أرقام فقط بلا بادئة حروف: القارئ يكتب كلوحة مفاتيح، والحروف تتحول عربية لو اللغة عربية.
 *
 * الطابعة الحرارية تطبع صورة نقطية (203 نقطة/بوصة)، فلو وقع حد خط بين نقطتين يتشوّش
 * الباركود. نجعل عرض أضيق خط عدداً صحيحاً من نقاط الطابعة (2 نقطة = 0.25mm) ونحسب
 * العرض بالـ CSS من نفس معامل htmlRaster، فيطلع حاداً ويقرأه أي قارئ.
 */

const DOTS_PER_MODULE: Record<PaperWidth, number> = { 58: 2, 80: 2 };
/** المنطقة الصامتة يمين ويسار (10 وحدات، معيار Code128). */
const QUIET = 10;

function bars(value: string): { svg: SVGSVGElement; modules: number } | null {
  if (typeof document === "undefined") return null;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  let valid = false;
  try {
    JsBarcode(svg, value, {
      format: "CODE128",
      width: 1,
      height: 40,
      margin: 0,
      displayValue: false,
      flat: true,
      valid: (ok) => {
        valid = ok;
      },
    });
  } catch {
    return null;
  }
  // JsBarcode يكتب العرض «123px»: Number تعطي NaN فيختفي الباركود.
  const modules = parseFloat(svg.getAttribute("width") ?? "");
  if (!valid || !modules) return null;
  svg.setAttribute("viewBox", `${-QUIET} 0 ${modules + QUIET * 2} 40`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("shape-rendering", "crispEdges");
  svg.removeAttribute("style");
  return { svg, modules: modules + QUIET * 2 };
}

/** SVG بعرض نقاط الطابعة الحرارية بالضبط وارتفاع ~9mm. */
export function thermalBarcodeSvg(value: string, paperMm: PaperWidth): string {
  const b = bars(value);
  if (!b) return "";
  const width = b.modules * DOTS_PER_MODULE[paperMm] * cssPxPerDot(paperMm);
  b.svg.setAttribute("width", width.toFixed(3));
  b.svg.setAttribute("height", "34");
  return b.svg.outerHTML;
}

/** SVG لفاتورة A4 (طابعة عادية بدقة عالية: يكفي عرض ثابت مناسب). */
export function a4BarcodeSvg(value: string): string {
  const b = bars(value);
  if (!b) return "";
  b.svg.setAttribute("width", String(Math.round(b.modules * 1.6)));
  b.svg.setAttribute("height", "40");
  return b.svg.outerHTML;
}
