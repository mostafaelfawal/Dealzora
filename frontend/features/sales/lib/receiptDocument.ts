/**
 * مستند الفاتورة المطبوعة: نموذج واحد (بيع أو مرتجع) يُرسم بشكلين:
 *  - حراري: إيصال رول بعرض 58/80 مم (يُطبع كصورة ESC/POS أو بنافذة الطباعة).
 *  - A4:    فاتورة كاملة بجدول وترويسة وشعار لأي طابعة عادية.
 *
 * الشكل (الشعار، البيانات، ما يظهر، الخط، اللون) من إعداد المحل ReceiptConfig،
 * والافتراضي يطابق الإيصال القديم تماماً. مستقل بلا خطوط خارجية حتى يطبع بدون إنترنت.
 */

import { currencySymbol } from "@/lib/currency";
import { formatDateTime } from "@/lib/dates";
import { formatNumber, formatQty } from "@/lib/format";
import type { PaperWidth, PrinterKind } from "@/lib/printerPrefs";
import type { ReceiptConfig } from "@/lib/receiptConfig";

import type { EtaPrint } from "../types/sale";
import { E_RECEIPT_CSS, eReceiptBlockHtml, qrSvg } from "./eReceiptPrint";
import { a4BarcodeSvg, thermalBarcodeSvg } from "./receiptBarcode";

export interface DocLine {
  name: string;
  qty: number;
  unit: string;
  /** null في المرتجع (لا سعر وحدة مخزّن). */
  unitPrice: number | null;
  /** نص الخصم/العرض على السطر، أو "". */
  discount: string;
  total: number;
}

export interface DocRow {
  label: string;
  value: string;
}

export interface ReceiptModel {
  kind: "sale" | "return";
  /** «فاتورة بيع» / «إيصال مرتجع». */
  title: string;
  number: number;
  /** سطر مرجعي (المرتجع: من فاتورة رقم …). */
  reference: string | null;
  date: number;
  reprint: boolean;
  cashier: string | null;
  customer: string | null;
  customerPhone: string | null;
  lines: DocLine[];
  /** ما قبل الإجمالي (الخصومات والضريبة). */
  totals: DocRow[];
  grandLabel: string;
  grand: number;
  /** الإجمالي بالعملة الثانية وسعر الصرف (قيم HTML آمنة)، أو فارغة. */
  alt: DocRow[];
  /** الدفع والباقي والآجل. */
  payments: DocRow[];
  /** سطور إضافية صغيرة (نقاط الولاء، سبب المرتجع، ملاحظة). */
  notes: string[];
  eta: EtaPrint | null;
}

export interface RenderOptions {
  kind: PrinterKind;
  paperMm: PaperWidth;
  config: ReceiptConfig;
  shopName: string;
  /** خطة «بَسطة» المجانية: سطر Dealzora في الآخر إجباري (لا يُخفى بإعداد الفاتورة). */
  freePlan: boolean;
}

export const esc = (text: string) =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const money = (n: number) => formatNumber(n);

export const BRANDING_LINE = "Dealzora لإدارة الأنشطة التجارية";

/** سطر Dealzora: إجباري في المجانية، واختياري (من تصميم الفاتورة) في الخطط المدفوعة. */
const showBranding = (o: RenderOptions) => o.freePlan || o.config.showBranding;

export function renderReceipt(
  model: ReceiptModel,
  opts: RenderOptions,
): string {
  return opts.kind === "a4"
    ? renderA4(model, opts)
    : renderThermal(model, opts);
}

/* ======================= الحراري ======================= */

const THERMAL_FONT: Record<ReceiptConfig["fontSize"], number> = {
  small: 11,
  normal: 12,
  large: 13.5,
};

function renderThermal(m: ReceiptModel, o: RenderOptions): string {
  const c = o.config;
  const base = THERMAL_FONT[c.fontSize];
  const row = (label: string, value: string, cls = "") =>
    `<div class="row ${cls}"><span>${label}</span><span class="num">${value}</span></div>`;

  const compact = c.compact;
  const sub = (l: DocLine) =>
    `${formatQty(l.qty)} ${esc(l.unit)}${l.unitPrice !== null ? ` × ${money(l.unitPrice)}` : ""}`;

  // المختصر: الاسم والإجمالي في سطر واحد، وسطر الكمية فقط لو فيه معلومة (كمية ≠ 1 أو خصم).
  const lines = m.lines
    .map((l) =>
      compact
        ? `
      <tr><td class="name">${esc(l.name)}</td><td class="num name">${money(l.total)}</td></tr>
      ${
        l.qty !== 1 || l.discount
          ? `<tr class="sub"><td colspan="2">${sub(l)}${l.discount ? ` · ${esc(l.discount)}` : ""}</td></tr>`
          : ""
      }`
        : `
      <tr><td colspan="3" class="name">${esc(l.name)}</td></tr>
      <tr class="sub">
        <td>${sub(l)}</td>
        <td>${esc(l.discount)}</td>
        <td class="num">${money(l.total)}</td>
      </tr>`,
    )
    .join("");

  const center = (parts: (string | false | null | undefined)[]) =>
    parts
      .filter(Boolean)
      .map((t) => `<div class="center muted">${t}</div>`)
      .join("");
  const join = (parts: (string | false | null | undefined)[]) =>
    parts.filter(Boolean).join(" · ");

  const taxNo = c.taxNumber
    ? `الرقم الضريبي: <span dir="ltr">${esc(c.taxNumber)}</span>`
    : null;
  const contact = compact
    ? center([
        join([
          c.address && esc(c.address),
          c.phone && `ت: <span dir="ltr">${esc(c.phone)}</span>`,
          taxNo,
        ]),
      ])
    : center([
        c.address && esc(c.address),
        c.phone && `ت: ${esc(c.phone)}`,
        taxNo,
      ]);

  const docNo = `${m.kind === "return" ? "مرتجع" : "فاتورة"} رقم <b>${m.number}</b>${m.reference ? ` · ${esc(m.reference)}` : ""}`;
  const people = [
    c.showCashier && m.cashier && `الكاشير: ${esc(m.cashier)}`,
    c.showCustomer && m.customer && `العميل: ${esc(m.customer)}`,
  ];
  const meta = compact
    ? center([join([docNo, esc(formatDateTime(m.date))]), join(people)])
    : center([docNo, esc(formatDateTime(m.date)), ...people]);

  // المختصر: «الإجمالي قبل الخصم» بلا خصم ولا ضريبة = الإجمالي نفسه، فلا نكرره.
  const totals = compact && m.totals.length === 1 ? [] : m.totals;
  const payments = c.showPaymentDetails ? m.payments : [];
  // المختصر على 80مم: الدفع في عمودين (المدفوع والباقي في سطر واحد).
  const payGrid = compact && o.paperMm === 80 && payments.length > 1;
  const payHtml = payGrid
    ? `<div class="pay">${payments.map((r) => `<div class="row"><span>${esc(r.label)}</span><span class="num">${r.value}</span></div>`).join("")}</div>`
    : payments.map((r) => row(esc(r.label), r.value)).join("");

  const barcode =
    c.showBarcode && m.kind === "sale"
      ? `<div class="barcode">${thermalBarcodeSvg(String(m.number), o.paperMm)}<div class="code">${m.number}</div></div>`
      : "";

  const body = `
  ${c.showLogo && c.logo ? `<div class="logo"><img src="${c.logo}" alt=""></div>` : ""}
  <h1>${esc(o.shopName)}</h1>
  ${c.headerNote ? `<div class="center muted">${esc(c.headerNote)}</div>` : ""}
  ${contact}
  ${m.kind === "return" ? `<div class="center tag">${esc(m.title)}</div>` : ""}
  ${m.reprint ? `<div class="center tag">نسخة</div>` : ""}
  ${meta}
  <hr><table>${lines}</table><hr>
  ${totals.map((r) => row(esc(r.label), r.value)).join("")}
  ${row(`${esc(m.grandLabel)} (${currencySymbol()})`, money(m.grand), "total")}
  ${m.alt.map((r) => row(esc(r.label), r.value, "alt")).join("")}
  ${payHtml}
  ${m.notes.length ? `<hr>${m.notes.map((n) => `<div class="center muted">${esc(n)}</div>`).join("")}` : ""}
  ${m.eta ? eReceiptBlockHtml(m.eta, o.paperMm, m.kind) : ""}
  ${barcode ? `<hr>${barcode}` : ""}
  ${c.footer ? `${barcode ? "" : "<hr>"}<div class="center foot">${esc(c.footer)}</div>` : ""}
  ${showBranding(o) ? `<div class="center muted" style="margin-top:2px">${BRANDING_LINE}</div>` : ""}`;

  const paper = o.paperMm;
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<title>${esc(`${m.title} ${m.number}`)}</title>
<style>
  @page { size: ${paper}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { width: ${paper - 6}mm; margin: 0 auto; padding: ${compact ? 2 : 3}mm 0;
         font: ${base}px/${compact ? 1.3 : 1.45} Tahoma, "Segoe UI", Arial, sans-serif; color: #000; }
  h1 { font-size: ${base + 4}px; margin: 0 0 2px; text-align: center; }
  .logo { text-align: center; margin-bottom: 3px; }
  .logo img { max-width: 60%; max-height: ${compact ? 15 : 22}mm; filter: grayscale(1) contrast(1.2); }
  .center { text-align: center; }
  .muted { font-size: ${base - 1}px; }
  .tag { font-weight: bold; font-size: ${base + 1}px; margin: 2px 0; }
  .foot { white-space: pre-line; }
  hr { border: 0; border-top: 1px dashed #000; margin: ${compact ? 4 : 6}px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 0; vertical-align: top; }
  .name { font-weight: bold; padding-top: ${compact ? 2 : 3}px; }
  .sub td { font-size: ${base - 1}px; }
  .num { text-align: left; direction: ltr; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .total { font-size: ${base + 4}px; font-weight: bold; margin: 3px 0; }
  .alt { font-size: ${base - 1}px; }
  .pay { display: grid; grid-template-columns: 1fr 1fr; column-gap: 12px; font-size: ${base - 1}px; }
  .barcode { text-align: center; line-height: 0; margin: 2px 0; }
  .barcode svg { display: inline-block; }
  .barcode .code { font: ${base - 1}px/1.2 Consolas, "Courier New", monospace; letter-spacing: 2px; margin-top: 2px; }${m.eta ? E_RECEIPT_CSS : ""}
</style></head><body>${body}
</body></html>`;
}

/* ======================= A4 ======================= */

function renderA4(m: ReceiptModel, o: RenderOptions): string {
  const c = o.config;
  const accent = /^#[0-9a-f]{6}$/i.test(c.accent) ? c.accent : "#1f2937";
  const showPrice = m.lines.some((l) => l.unitPrice !== null);
  const showDiscount = m.lines.some((l) => l.discount);

  const rows = m.lines
    .map(
      (l, i) => `<tr>
        <td class="idx">${i + 1}</td>
        <td class="item">${esc(l.name)}</td>
        <td class="num">${formatQty(l.qty)}</td>
        <td>${esc(l.unit)}</td>
        ${showPrice ? `<td class="num">${l.unitPrice !== null ? money(l.unitPrice) : ""}</td>` : ""}
        ${showDiscount ? `<td class="disc">${esc(l.discount)}</td>` : ""}
        <td class="num strong">${money(l.total)}</td>
      </tr>`,
    )
    .join("");

  const info: DocRow[] = [];
  if (c.showCustomer && m.customer)
    info.push({ label: "العميل", value: m.customer });
  if (c.showCustomer && m.customerPhone)
    info.push({ label: "هاتف العميل", value: m.customerPhone });
  if (c.showCashier && m.cashier)
    info.push({ label: "الكاشير", value: m.cashier });

  const contact = [
    c.address,
    c.phone && `هاتف: ${c.phone}`,
    c.taxNumber && `الرقم الضريبي: ${c.taxNumber}`,
  ].filter(Boolean) as string[];

  const eta = m.eta
    ? `<div class="eta">
        <div class="eta-qr">${qrSvg(m.eta.qrModules, 80)}</div>
        <div class="eta-info">
          <b>إيصال إلكتروني${m.kind === "return" ? " (مرتجع)" : ""}</b>
          <div>${esc(m.eta.tradeName)} · رقم التسجيل <span dir="ltr">${esc(m.eta.rin)}</span></div>
          <div>الفرع <span dir="ltr">${esc(m.eta.branchCode)}</span> · الجهاز <span dir="ltr">${esc(m.eta.deviceSerial)}</span> · رقم الإيصال <span dir="ltr">${esc(m.eta.receiptNumber)}</span></div>
          <div class="uuid">${esc(m.eta.uuid)}</div>
          <div>امسح الكود للتحقق على بوابة منظومة الإيصال الإلكتروني</div>
        </div>
      </div>`
    : "";

  const body = `
  <header class="head">
    <div class="brand">
      ${c.showLogo && c.logo ? `<img class="logo" src="${c.logo}" alt="">` : ""}
      <div>
        <div class="shop">${esc(o.shopName)}</div>
        ${c.headerNote ? `<div class="note">${esc(c.headerNote)}</div>` : ""}
        ${contact.map((t) => `<div class="contact">${esc(t)}</div>`).join("")}
      </div>
    </div>
    <div class="doc">
      <div class="doc-title">${esc(m.title)}${m.reprint ? ` <span class="copy">نسخة</span>` : ""}</div>
      <table class="meta">
        <tr><th>الرقم</th><td class="num">${m.number}</td></tr>
        <tr><th>التاريخ</th><td>${esc(formatDateTime(m.date))}</td></tr>
        ${m.reference ? `<tr><th>المرجع</th><td>${esc(m.reference)}</td></tr>` : ""}
      </table>
      ${c.showBarcode && m.kind === "sale" ? `<div class="a4-barcode">${a4BarcodeSvg(String(m.number))}</div>` : ""}
    </div>
  </header>

  ${info.length ? `<section class="info">${info.map((r) => `<div><span>${esc(r.label)}:</span> <b>${esc(r.value)}</b></div>`).join("")}</section>` : ""}

  <table class="items">
    <thead><tr>
      <th class="idx">#</th><th>الصنف</th><th>الكمية</th><th>الوحدة</th>
      ${showPrice ? "<th>سعر الوحدة</th>" : ""}${showDiscount ? "<th>الخصم</th>" : ""}
      <th>الإجمالي</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <section class="bottom">
    <div class="side">
      ${c.showPaymentDetails && m.payments.length ? `<div class="box"><div class="box-title">الدفع</div>${m.payments.map((r) => `<div class="row"><span>${esc(r.label)}</span><span class="num">${r.value}</span></div>`).join("")}</div>` : ""}
      ${m.notes.length ? `<div class="box">${m.notes.map((n) => `<div>${esc(n)}</div>`).join("")}</div>` : ""}
    </div>
    <div class="sums">
      ${m.totals.map((r) => `<div class="row"><span>${esc(r.label)}</span><span class="num">${r.value}</span></div>`).join("")}
      <div class="row grand"><span>${esc(m.grandLabel)}</span><span class="num">${money(m.grand)} ${esc(currencySymbol())}</span></div>
      ${m.alt.map((r) => `<div class="row alt"><span>${esc(r.label)}</span><span class="num">${r.value}</span></div>`).join("")}
    </div>
  </section>

  ${eta}
  ${c.terms ? `<section class="terms"><b>الشروط والأحكام</b><div>${esc(c.terms)}</div></section>` : ""}
  <footer class="foot">
    ${c.footer ? `<div>${esc(c.footer)}</div>` : ""}
    ${showBranding(o) ? `<div class="by">${BRANDING_LINE}</div>` : ""}
  </footer>`;

  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<title>${esc(`${m.title} ${m.number}`)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; color: #111; font: 12px/1.5 Tahoma, "Segoe UI", Arial, sans-serif; }
  .num { direction: ltr; text-align: left; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start;
          padding-bottom: 12px; border-bottom: 3px solid ${accent}; }
  .brand { display: flex; gap: 12px; align-items: center; min-width: 0; }
  .logo { max-width: 34mm; max-height: 26mm; object-fit: contain; }
  .shop { font-size: 22px; font-weight: 700; color: ${accent}; line-height: 1.2; }
  .note { font-size: 12px; margin-top: 2px; }
  .contact { font-size: 11px; color: #444; }
  .doc { text-align: left; flex-shrink: 0; }
  .doc-title { font-size: 20px; font-weight: 700; color: ${accent}; text-align: right; }
  .copy { font-size: 11px; border: 1px solid ${accent}; padding: 0 6px; vertical-align: middle; }
  .a4-barcode { margin-top: 6px; line-height: 0; text-align: right; }
  .a4-barcode svg { display: inline-block; }
  .meta { border-collapse: collapse; margin-top: 4px; font-size: 11.5px; }
  .meta th { text-align: right; color: #555; font-weight: 400; padding: 1px 0 1px 10px; }
  .meta td { text-align: right; font-weight: 700; }
  .info { display: flex; flex-wrap: wrap; gap: 6px 28px; margin: 12px 0 0; padding: 8px 12px; background: #f5f5f5; }
  .info div { display: inline-flex; align-items: baseline; gap: 6px; }
  .info span { color: #555; }
  .items { width: 100%; border-collapse: collapse; margin-top: 14px; }
  .items thead { display: table-header-group; }
  .items th { background: ${accent}; color: #fff; font-weight: 600; padding: 7px 8px; text-align: right; font-size: 11.5px; }
  .items td { padding: 6px 8px; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
  .items tbody tr:nth-child(even) td { background: #fafafa; }
  .items tr { break-inside: avoid; }
  .items .idx { width: 28px; text-align: center; color: #666; }
  .items .item { font-weight: 600; }
  .items .disc { font-size: 11px; color: #555; }
  .items .strong { font-weight: 700; }
  .bottom { display: flex; justify-content: space-between; gap: 20px; margin-top: 14px; break-inside: avoid; }
  .side { flex: 1; display: flex; flex-direction: column; gap: 8px; }
  .box { border: 1px solid #e5e5e5; padding: 8px 10px; font-size: 11.5px; }
  .box-title { font-weight: 700; margin-bottom: 4px; }
  .row { display: flex; justify-content: space-between; gap: 12px; padding: 2px 0; }
  .sums { width: 44%; font-size: 12px; }
  .sums .row { padding: 4px 0; border-bottom: 1px solid #eee; }
  .sums .alt { font-size: 11px; color: #444; border-bottom: 0; padding: 2px 0; }
  .grand { margin-top: 6px; padding: 8px 10px !important; border: 0 !important;
           background: ${accent}; color: #fff; font-size: 16px; font-weight: 700; }
  .eta { display: flex; gap: 12px; align-items: center; margin-top: 14px; padding: 8px 10px;
         border: 1px solid #e5e5e5; font-size: 10.5px; break-inside: avoid; }
  .eta-qr svg { width: 30mm; height: auto; display: block; }
  .uuid { font: 9px/1.3 Consolas, "Courier New", monospace; direction: ltr; text-align: right; word-break: break-all; color: #444; }
  .terms { margin-top: 14px; padding: 8px 10px; border-inline-start: 3px solid ${accent}; background: #fafafa;
           font-size: 10.5px; white-space: pre-line; break-inside: avoid; }
  .foot { margin-top: 18px; text-align: center; font-size: 12px; white-space: pre-line; break-inside: avoid; }
  .by { font-size: 10px; color: #777; margin-top: 4px; }
</style></head><body>${body}
</body></html>`;
}
