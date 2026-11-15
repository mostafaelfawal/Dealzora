import { invoke, isTauri } from "@tauri-apps/api/core";
import { toast } from "sonner";

import { formatDateTime } from "@/lib/dates";
import { getCachedPlan, upgradeMessage } from "@/lib/plan";
import { printReceiptHtml } from "@/lib/print";
import { getPrinterPrefs } from "@/lib/printerPrefs";
import { currencySymbol } from "@/lib/currency";
import { formatNumber, formatQty } from "@/lib/format";

import { RETURN_REASON_LABEL } from "../config/saleOptions";
import type { Sale, SaleReturn } from "../types/sale";
import { saleTaxRows } from "./saleTax";

const FOOTER = "شكراً لزيارتكم";
/** خطة «بَسطة» المجانية: سطر صغير في آخر الإيصال (إعلان يساعد على انتشار البرنامج). */
const FREE_FOOTER = "بواسطة Dealzora";
const EG_COUNTRY = "20";

const esc = (text: string) =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const money = (n: number) => formatNumber(n);

/** HTML مستقل للإيصال (بدون خطوط خارجية حتى يطبع بدون إنترنت). */
export function buildReceiptHtml(
  sale: Sale,
  shopName: string,
  reprint = false,
): string {
  const rows = sale.lines
    .map(
      (l) => `
      <tr><td colspan="3" class="name">${esc(l.name)}</td></tr>
      <tr class="sub">
        <td>${formatQty(l.qty)} ${esc(l.unitName)} × ${money(l.unitPrice)}</td>
        <td>${l.promoDiscount > 0 ? `${esc(l.promoName ?? "عرض")} −${money(l.promoDiscount)}` : ""}${l.discount > 0 ? ` خصم ${money(l.discount)}` : ""}</td>
        <td class="num">${money(l.lineTotal)}</td>
      </tr>`,
    )
    .join("");

  const discount = sale.invoiceDiscount + sale.linesDiscount;

  return receiptDocument(
    `فاتورة ${sale.number}`,
    `
  <h1>${esc(shopName)}</h1>
  ${reprint ? `<div class="center tag">نسخة</div>` : ""}
  <div class="center muted">فاتورة رقم <b>${sale.number}</b></div>
  <div class="center muted">${esc(formatDateTime(sale.soldAt))}</div>
  ${sale.cashierName ? `<div class="center muted">الكاشير: ${esc(sale.cashierName)}</div>` : ""}
  ${sale.customerName ? `<div class="center muted">العميل: ${esc(sale.customerName)}</div>` : ""}
  <hr><table>${rows}</table><hr>
  ${line("الإجمالي قبل الخصم", money(sale.subtotal))}
  ${sale.promoDiscount > 0 ? line("العروض", money(sale.promoDiscount)) : ""}
  ${discount > 0 ? line("الخصم", money(discount)) : ""}
  ${sale.loyaltyDiscount > 0 ? line(`خصم ${sale.loyaltyRedeemed} نقطة`, money(sale.loyaltyDiscount)) : ""}
  ${saleTaxRows(sale)
    .map((r) => line(esc(r.label), money(r.amount)))
    .join("")}
  ${line(`الإجمالي (${currencySymbol()})`, money(sale.total), "total")}
  ${line("طريقة الدفع", sale.paymentLabel)}
  ${sale.cashAmount > 0 ? line("المدفوع نقداً", money(sale.received || sale.cashAmount)) : ""}
  ${sale.change > 0 ? line("الباقي", money(sale.change)) : ""}
  ${sale.creditAmount > 0 ? line("آجل على الحساب", money(sale.creditAmount)) : ""}
  ${sale.walletAmount > 0 ? line(`مدفوع ${sale.paymentLabel}`, money(sale.walletAmount)) : ""}
  ${sale.walletAmount > 0 && sale.paymentRef ? line("رقم العملية", esc(sale.paymentRef)) : ""}
  ${sale.returnedTotal > 0 ? line("مرتجع من الفاتورة", money(sale.returnedTotal)) : ""}
  ${sale.customerPoints !== null && (sale.loyaltyEarned > 0 || sale.loyaltyRedeemed > 0) ? `<hr><div class="center muted">كسبت ${sale.loyaltyEarned} نقطة · رصيدك ${sale.customerPoints} نقطة</div>` : ""}
  ${footer()}`,
  );
}

/** إيصال المرتجع: الأصناف الراجعة وكيف رُد المبلغ للعميل. */
export function buildReturnReceiptHtml(ret: SaleReturn, shopName: string): string {
  const rows = ret.lines
    .map(
      (l) => `
      <tr><td colspan="2" class="name">${esc(l.name)}</td></tr>
      <tr class="sub">
        <td>${formatQty(l.qty)} ${esc(l.unitName)}</td>
        <td class="num">${money(l.amount)}</td>
      </tr>`,
    )
    .join("");

  return receiptDocument(
    `مرتجع ${ret.number}`,
    `
  <h1>${esc(shopName)}</h1>
  <div class="center tag">إيصال مرتجع</div>
  <div class="center muted">مرتجع رقم <b>${ret.number}</b> · من فاتورة <b>${ret.saleNumber}</b></div>
  <div class="center muted">${esc(formatDateTime(ret.returnedAt))}</div>
  ${ret.cashierName ? `<div class="center muted">الكاشير: ${esc(ret.cashierName)}</div>` : ""}
  ${ret.customerName ? `<div class="center muted">العميل: ${esc(ret.customerName)}</div>` : ""}
  <hr><table>${rows}</table><hr>
  ${line(`قيمة المرتجع (${currencySymbol()})`, money(ret.total), "total")}
  ${ret.taxTotal ? line("منها ضريبة القيمة المضافة", money(ret.taxTotal)) : ""}
  ${ret.cashRefund > 0 ? line("رُد نقداً", money(ret.cashRefund)) : ""}
  ${ret.walletRefund > 0 ? line("حُوّل للمحفظة", money(ret.walletRefund)) : ""}
  ${ret.creditRefund > 0 ? line("خُصم من حساب العميل", money(ret.creditRefund)) : ""}
  ${line("السبب", esc(RETURN_REASON_LABEL[ret.reason]))}
  ${ret.note ? `<div class="muted">ملاحظة: ${esc(ret.note)}</div>` : ""}
  ${footer()}`,
  );
}

const line = (label: string, value: string, cls = "") =>
  `<div class="row ${cls}"><span>${label}</span><span class="num">${value}</span></div>`;

const footer = () =>
  `<hr><div class="center">${FOOTER}</div>
  ${getCachedPlan()?.isFree ? `<div class="center muted" style="margin-top:4px">${FREE_FOOTER}</div>` : ""}`;

/** هيكل الإيصال المشترك (بيع/مرتجع) بعرض ورق الطابعة المختار على هذا الجهاز. */
function receiptDocument(title: string, body: string): string {
  const paper = getPrinterPrefs().paperMm;
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  @page { size: ${paper}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { width: ${paper - 6}mm; margin: 0 auto; padding: 3mm 0;
         font: 12px/1.45 Tahoma, "Segoe UI", Arial, sans-serif; color: #000; }
  h1 { font-size: 16px; margin: 0 0 2px; text-align: center; }
  .center { text-align: center; }
  .muted { font-size: 11px; }
  .tag { font-weight: bold; font-size: 13px; margin: 2px 0; }
  hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 0; vertical-align: top; }
  .name { font-weight: bold; padding-top: 3px; }
  .sub td { font-size: 11px; }
  .num { text-align: left; direction: ltr; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .total { font-size: 16px; font-weight: bold; margin: 3px 0; }
</style></head><body>${body}
</body></html>`;
}

/**
 * يطبع إيصال البيع: مباشرة على الطابعة الحرارية لو مختارة، وإلا بنافذة الطباعة.
 * openDrawer: بعد البيع فقط (ليس عند إعادة الطباعة)، ويفتح الدرج لو فيه نقدية.
 */
export function printReceipt(
  sale: Sale,
  shopName: string,
  opts: { reprint?: boolean; openDrawer?: boolean } = {},
) {
  return printReceiptHtml(buildReceiptHtml(sale, shopName, opts.reprint), {
    jobName: `فاتورة ${sale.number}`,
    openDrawer: Boolean(opts.openDrawer) && sale.cashAmount > 0,
  });
}

export function printReturnReceipt(
  ret: SaleReturn,
  shopName: string,
  opts: { openDrawer?: boolean } = {},
) {
  return printReceiptHtml(buildReturnReceiptHtml(ret, shopName), {
    jobName: `مرتجع ${ret.number}`,
    openDrawer: Boolean(opts.openDrawer) && ret.cashRefund > 0,
  });
}

/* ---------- واتساب ---------- */

/** 01012345678 → 201012345678 (مصر). الأرقام الدولية (+) كما هي. */
export function toWhatsappNumber(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits.slice(1) || null;
  if (digits.startsWith("00")) return digits.slice(2) || null;
  if (digits.startsWith("0")) return EG_COUNTRY + digits.slice(1);
  return digits || null;
}

export function buildWhatsappText(sale: Sale, shopName: string): string {
  const lines = sale.lines
    .map(
      (l) =>
        `• ${l.name} — ${formatQty(l.qty)} × ${money(l.unitPrice)} = ${money(l.lineTotal)}`,
    )
    .join("\n");
  const discount = sale.invoiceDiscount + sale.linesDiscount;
  return [
    `*${shopName}*`,
    `فاتورة رقم ${sale.number} — ${formatDateTime(sale.soldAt)}`,
    "",
    lines,
    "",
    sale.promoDiscount > 0
      ? `العروض: ${money(sale.promoDiscount)} ${currencySymbol()}`
      : null,
    discount > 0 ? `الخصم: ${money(discount)} ${currencySymbol()}` : null,
    sale.loyaltyDiscount > 0
      ? `خصم ${sale.loyaltyRedeemed} نقطة: ${money(sale.loyaltyDiscount)} ${currencySymbol()}`
      : null,
    ...saleTaxRows(sale).map(
      (r) => `${r.label}: ${money(r.amount)} ${currencySymbol()}`,
    ),
    `*الإجمالي: ${money(sale.total)} ${currencySymbol()}*`,
    sale.creditAmount > 0
      ? `آجل على الحساب: ${money(sale.creditAmount)} ${currencySymbol()}`
      : null,
    sale.walletAmount > 0
      ? `مدفوع ${sale.paymentLabel}: ${money(sale.walletAmount)} ${currencySymbol()}`
      : null,
    "",
    FOOTER,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

/** يفتح محادثة واتساب بنص الفاتورة. بدون رقم = يختار المستخدم جهة الاتصال. */
export async function sendWhatsapp(
  sale: Sale,
  shopName: string,
  phone?: string | null,
) {
  // مكان واحد يغطي كل أزرار واتساب (الكاشير وتفاصيل الفاتورة).
  const plan = getCachedPlan();
  if (plan && !plan.features.includes("whatsapp")) {
    toast.info(upgradeMessage("whatsapp"), { duration: 6000 });
    return;
  }
  const number = phone ? toWhatsappNumber(phone) : null;
  const url = `https://wa.me/${number ?? ""}?text=${encodeURIComponent(buildWhatsappText(sale, shopName))}`;
  if (isTauri()) await invoke("open_whatsapp", { url });
  else window.open(url, "_blank", "noopener,noreferrer");
}
