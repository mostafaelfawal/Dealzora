import { invoke, isTauri } from "@tauri-apps/api/core";

import { printHtml } from "./print";
import type { SavedFile } from "./saveFile";

/**
 * مستند A4 احترافي من محتوى معروض في البرنامج (تقارير بجداول ورسوم)، ثم ملف PDF.
 *
 * المحتوى نفسه هو ما يرسمه البرنامج (نفس المكونات والرسوم SVG)، مع ستايل البرنامج كاملاً
 * والخطوط مضمّنة في الملف، فيطلع الـ PDF مطابقاً للشاشة لكن بتنسيق طباعة A4:
 * ترويسة وأرقام صفحات في كل صفحة، وعمود واحد للرسوم، وجداول تتكسر بين الصفحات بعناوينها.
 */

/**
 * عرض المحتوى في صفحة A4 (210mm − هوامش 12mm × 2) بوحدات CSS.
 * الرسوم تُرسم بهذا العرض من البداية، فلا نصغّرها بـ max-width: Recharts 3 يضع الرسم
 * داخل غلاف عرضه صفر (overflow ظاهر)، فـ max-width: 100% يجعل الرسم بعرض صفر ويختفي.
 */
export const A4_CONTENT_WIDTH_PX = 700;

/**
 * تنسيق المحتوى للطباعة. يُطبق أيضاً على مسرح التجهيز داخل البرنامج (.pdf-root)
 * حتى تُرسم الرسوم البيانية بعرض الصفحة من البداية.
 */
export const PDF_LAYOUT_CSS = `
.pdf-root .grid:has(.recharts-responsive-container) { grid-template-columns: minmax(0, 1fr) !important; }
.pdf-root .grid:has(.recharts-responsive-container) > * { grid-column: auto !important; }
.pdf-root button, .pdf-root [role="tablist"], .pdf-root [role="combobox"],
.pdf-root input, .pdf-root select, .pdf-root a.text-primary,
.pdf-root .recharts-tooltip-wrapper { display: none !important; }
`;

const PRINT_CSS = `
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { background: #fff !important; margin: 0; }
body { color: #111; font-size: 11px; }
.pdf-root *, .pdf-root *::before, .pdf-root *::after { animation: none !important; transition: none !important; }
.pdf-root a { color: inherit; text-decoration: none; }
.pdf-root .overflow-x-auto, .pdf-root .overflow-auto { overflow: visible !important; }
.pdf-root table { width: 100% !important; min-width: 0 !important; }
.pdf-root [class*="min-w-"] { min-width: 0 !important; }
.pdf-root td, .pdf-root th, .pdf-root .truncate {
  white-space: normal !important; max-width: none !important;
  overflow: visible !important; text-overflow: clip !important;
}
.pdf-root td, .pdf-root th { height: auto !important; padding-top: 4px !important; padding-bottom: 4px !important; }
.pdf-root thead { display: table-header-group; }
.pdf-root tr { break-inside: avoid; }
.pdf-root section:not(:has(table)), .pdf-root .recharts-responsive-container,
.pdf-root .pdf-avoid { break-inside: avoid; }
.pdf-root .shadow, .pdf-root [class*="shadow-"] { box-shadow: none !important; }

.pdf-cover { border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 14px; }
.pdf-cover .shop { font-size: 22px; font-weight: 700; margin: 0; }
.pdf-cover .title { font-size: 15px; font-weight: 600; margin: 2px 0 6px; color: #333; }
.pdf-cover .meta { display: flex; flex-wrap: wrap; gap: 4px 18px; font-size: 10px; color: #555; }
.pdf-toc { margin: 0 0 14px; padding: 8px 12px; border: 1px solid #ddd; font-size: 10.5px; }
.pdf-toc b { display: block; margin-bottom: 4px; }
.pdf-toc ol { margin: 0; padding-inline-start: 18px; columns: 2; }
.pdf-section + .pdf-section { break-before: page; }
.pdf-section-title {
  font-size: 16px; font-weight: 700; margin: 0 0 10px; padding: 6px 10px;
  border-inline-start: 4px solid #111; background: #f3f4f6;
}
`;

const esc = (text: string) =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** نص داخل content: "…" في CSS. */
const cssString = (text: string) =>
  `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ")}"`;

/* ---------- ستايل البرنامج والخطوط ---------- */

const fontCache = new Map<string, string>();

async function toDataUrl(url: string): Promise<string | null> {
  const hit = fontCache.get(url);
  if (hit) return hit;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    fontCache.set(url, data);
    return data;
  } catch {
    return null;
  }
}

/** يضمّن ملفات الخط داخل ‎@font-face‎: Edge يفتح الملف من القرص ولا يصل لروابط البرنامج. */
async function inlineFontFace(cssText: string, base: string): Promise<string> {
  const urls = [...cssText.matchAll(/url\((['"]?)([^'")]+)\1\)/g)];
  let out = cssText;
  for (const [match, , raw] of urls) {
    if (raw.startsWith("data:")) continue;
    const data = await toDataUrl(new URL(raw, base).href);
    if (data) out = out.replace(match, `url("${data}")`);
  }
  return out;
}

/** كل ستايل البرنامج كنص واحد (ملفات CSS من نفس المصدر). */
export async function collectAppCss(): Promise<string> {
  const parts: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // ستايل من مصدر خارجي لا يُقرأ
    }
    const base = sheet.href ?? location.href;
    for (const rule of Array.from(rules)) {
      parts.push(
        rule instanceof CSSFontFaceRule
          ? await inlineFontFace(rule.cssText, base)
          : rule.cssText,
      );
    }
  }
  return parts.join("\n");
}

/* ---------- المستند ---------- */

export interface PdfSection {
  title: string;
  html: string;
}

export interface PdfDocumentSpec {
  /** اسم المحل: أعلى الصفحة الأولى وفي ترويسة كل صفحة. */
  shopName: string;
  title: string;
  /** الفترة أو "حتى اليوم". */
  periodLabel: string;
  generatedBy?: string;
  sections: PdfSection[];
  appCss: string;
}

export function buildPdfDocument(spec: PdfDocumentSpec): string {
  const now = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());
  // نفس فئات <html> في البرنامج (متغيرات الخطوط) لكن بالوضع الفاتح دائماً.
  const htmlClass = document.documentElement.className
    .split(/\s+/)
    .filter((c) => c && c !== "dark")
    .join(" ");
  const font = getComputedStyle(document.body).fontFamily;
  const marginBox = `font-family: ${font}; font-size: 8.5px; color: #666;`;

  const pageCss = `
@page {
  size: A4;
  margin: 18mm 12mm 15mm;
  @top-right { content: ${cssString(`${spec.shopName} · ${spec.title}`)}; ${marginBox} }
  @top-left { content: ${cssString(spec.periodLabel)}; ${marginBox} }
  @bottom-center { content: "صفحة " counter(page) " من " counter(pages); ${marginBox} }
  @bottom-left { content: "Dealzora"; ${marginBox} }
}
@page :first { @top-right { content: none; } @top-left { content: none; } }`;

  const toc =
    spec.sections.length > 1
      ? `<nav class="pdf-toc"><b>المحتويات</b><ol>${spec.sections
          .map((s) => `<li>${esc(s.title)}</li>`)
          .join("")}</ol></nav>`
      : "";

  const sections = spec.sections
    .map(
      (s) =>
        `<section class="pdf-section"><h2 class="pdf-section-title">${esc(s.title)}</h2>${s.html}</section>`,
    )
    .join("");

  return `<!doctype html><html dir="rtl" lang="ar" class="${esc(htmlClass)}"><head><meta charset="utf-8">
<title>${esc(`${spec.title} — ${spec.shopName}`)}</title>
<style>${spec.appCss}</style>
<style>${pageCss}${PRINT_CSS}${PDF_LAYOUT_CSS}</style>
</head><body class="font-sans"><div class="pdf-root">
<header class="pdf-cover">
  <p class="shop">${esc(spec.shopName)}</p>
  <p class="title">${esc(spec.title)}</p>
  <div class="meta">
    <span>${esc(spec.periodLabel)}</span>
    <span>أُعد في ${esc(now)}</span>
    ${spec.generatedBy ? `<span>بواسطة ${esc(spec.generatedBy)}</span>` : ""}
  </div>
</header>
${toc}
${sections}
</div></body></html>`;
}

/* ---------- الحفظ ---------- */

const PDF_ERRORS: Record<string, string> = {
  edge_not_found:
    "لم نجد متصفح Microsoft Edge على الجهاز (يُستخدم لتجهيز الـ PDF). سنفتح نافذة الطباعة بدلاً منه.",
  pdf_timeout: "استغرق تجهيز الملف وقتاً طويلاً. جرّب قسماً واحداً بدل التقرير الكامل.",
};

export class PdfError extends Error {}

/**
 * يحفظ المستند PDF في مجلد التنزيلات (داخل البرنامج).
 * في المتصفح أو بدون Edge: نافذة الطباعة (اختر «حفظ كـ PDF») ويرجع null.
 */
export async function saveHtmlAsPdf(
  html: string,
  fileName: string,
): Promise<SavedFile | null> {
  if (!isTauri()) {
    printHtml(html);
    return null;
  }
  try {
    const path = await invoke<string>("html_to_pdf", { html, fileName });
    return { fileName: path.split(/[\\/]/).pop() ?? fileName, path };
  } catch (e) {
    const code = typeof e === "string" ? e : (e as Error)?.message ?? "";
    if (code === "edge_not_found") {
      printHtml(html);
      throw new PdfError(PDF_ERRORS.edge_not_found);
    }
    throw new PdfError(PDF_ERRORS[code] ?? `تعذّر تجهيز ملف الـ PDF (${code})`);
  }
}
