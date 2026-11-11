import { invoke, isTauri } from "@tauri-apps/api/core";
import { toast } from "sonner";

import { formatDateTime } from "@/lib/dates";
import { getCachedPlan, upgradeMessage } from "@/lib/plan";
import { printHtml } from "@/lib/print";
import { currencySymbol } from "@/lib/currency";
import { formatNumber, formatQty } from "@/lib/format";

import { PAYMENT_LABEL } from "../config/saleOptions";
import type { Sale } from "../types/sale";

/** عرض ورق الطابعة الحرارية. 80mm هو الأشهر، و58mm للطابعات الصغيرة. */
export const RECEIPT_WIDTH_MM = 80;
const FOOTER = "شكراً لزيارتكم";
/** خطة «بَسطة» المجانية: سطر صغير في آخر الإيصال (إعلان يساعد على انتشار البرنامج). */
const FREE_FOOTER = "بواسطة Dealzora";
const EG_COUNTRY = "20";

const esc = (text: string) =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const money = (n: number) => formatNumber(n);

/** HTML مستقل للإيصال (بدون خطوط خارجية حتى يطبع بدون إنترنت). */
export function buildReceiptHtml(sale: Sale, shopName: string): string {
  const rows = sale.lines
    .map(
      (l) => `
      <tr><td colspan="3" class="name">${esc(l.name)}</td></tr>
      <tr class="sub">
        <td>${formatQty(l.qty)} ${esc(l.unitName)} × ${money(l.unitPrice)}</td>
        <td>${l.discount > 0 ? `خصم ${money(l.discount)}` : ""}</td>
        <td class="num">${money(l.lineTotal)}</td>
      </tr>`,
    )
    .join("");

  const discount = sale.invoiceDiscount + sale.linesDiscount;
  const line = (label: string, value: string, cls = "") =>
    `<div class="row ${cls}"><span>${label}</span><span class="num">${value}</span></div>`;

  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<title>فاتورة ${sale.number}</title>
<style>
  @page { size: ${RECEIPT_WIDTH_MM}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { width: ${RECEIPT_WIDTH_MM - 6}mm; margin: 0 auto; padding: 3mm 0;
         font: 12px/1.45 Tahoma, "Segoe UI", Arial, sans-serif; color: #000; }
  h1 { font-size: 16px; margin: 0 0 2px; text-align: center; }
  .center { text-align: center; }
  .muted { font-size: 11px; }
  hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 0; vertical-align: top; }
  .name { font-weight: bold; padding-top: 3px; }
  .sub td { font-size: 11px; }
  .num { text-align: left; direction: ltr; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .total { font-size: 16px; font-weight: bold; margin: 3px 0; }
</style></head><body>
  <h1>${esc(shopName)}</h1>
  <div class="center muted">فاتورة رقم <b>${sale.number}</b></div>
  <div class="center muted">${esc(formatDateTime(sale.soldAt))}</div>
  ${sale.cashierName ? `<div class="center muted">الكاشير: ${esc(sale.cashierName)}</div>` : ""}
  ${sale.customerName ? `<div class="center muted">العميل: ${esc(sale.customerName)}</div>` : ""}
  <hr><table>${rows}</table><hr>
  ${line("الإجمالي قبل الخصم", money(sale.subtotal))}
  ${discount > 0 ? line("الخصم", money(discount)) : ""}
  ${line(`الإجمالي (${currencySymbol()})`, money(sale.total), "total")}
  ${line("طريقة الدفع", PAYMENT_LABEL[sale.paymentMethod])}
  ${sale.cashAmount > 0 ? line("المدفوع كاش", money(sale.received || sale.cashAmount)) : ""}
  ${sale.change > 0 ? line("الباقي", money(sale.change)) : ""}
  ${sale.creditAmount > 0 ? line("آجل على الحساب", money(sale.creditAmount)) : ""}
  ${sale.returnedTotal > 0 ? line("مرتجع من الفاتورة", money(sale.returnedTotal)) : ""}
  <hr><div class="center">${FOOTER}</div>
  ${getCachedPlan()?.isFree ? `<div class="center muted" style="margin-top:4px">${FREE_FOOTER}</div>` : ""}
</body></html>`;
}

/** يطبع الإيصال بنافذة الطباعة الأصلية للنظام. */
export function printReceipt(sale: Sale, shopName: string) {
  printHtml(buildReceiptHtml(sale, shopName));
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
    discount > 0 ? `الخصم: ${money(discount)} ${currencySymbol()}` : null,
    `*الإجمالي: ${money(sale.total)} ${currencySymbol()}*`,
    sale.creditAmount > 0
      ? `آجل على الحساب: ${money(sale.creditAmount)} ${currencySymbol()}`
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
