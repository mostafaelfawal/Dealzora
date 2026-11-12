import { toast } from "sonner";

import { toWhatsappNumber } from "@/features/sales/lib/receipt";
import { currencySymbol } from "@/lib/currency";
import { formatDate } from "@/lib/dates";
import { formatNumber, formatQty } from "@/lib/format";
import { getCachedPlan, upgradeMessage } from "@/lib/plan";
import { printHtml } from "@/lib/print";
import { openWhatsapp } from "@/lib/whatsapp";

import type { PurchaseOrder } from "../types/purchaseOrder";

/** نص الطلب للمورد. الأسعار لا تُرسل افتراضياً (المورد يسعّر بنفسه)، والكميات واضحة بالوحدة. */
export function buildOrderText(
  o: PurchaseOrder,
  shopName: string,
  withPrices = false,
): string {
  const lines = o.lines
    .map(
      (l, i) =>
        `${i + 1}. ${l.name} — ${formatQty(l.qty)} ${l.unitName}` +
        (withPrices ? ` × ${formatNumber(l.unitCost)}` : ""),
    )
    .join("\n");
  return [
    `*${shopName}*`,
    `طلب شراء رقم ${o.number} — ${formatDate(o.createdAt)}`,
    `إلى: ${o.supplierName}`,
    "",
    lines,
    "",
    withPrices
      ? `*الإجمالي التقديري: ${formatNumber(o.total)} ${currencySymbol()}*`
      : null,
    o.note ? `ملاحظة: ${o.note}` : null,
    "برجاء تأكيد التوفر وموعد التوريد. شكراً",
  ]
    .filter((x) => x !== null)
    .join("\n");
}

export async function sendOrderWhatsapp(o: PurchaseOrder, shopName: string) {
  const plan = getCachedPlan();
  if (plan && !plan.features.includes("whatsapp")) {
    toast.info(upgradeMessage("whatsapp"), { duration: 6000 });
    return false;
  }
  const phone = o.supplierPhone ? toWhatsappNumber(o.supplierPhone) : null;
  await openWhatsapp(phone ?? "", buildOrderText(o, shopName));
  return true;
}

const esc = (text: string) =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** صفحة A4 للطلب (لإرسالها PDF أو تسليمها للمندوب). */
export function printOrder(o: PurchaseOrder, shopName: string) {
  const rows = o.lines
    .map(
      (l, i) => `<tr>
        <td>${i + 1}</td><td>${esc(l.name)}</td>
        <td class="num">${formatQty(l.qty)}</td><td>${esc(l.unitName)}</td>
        <td class="num">${formatNumber(l.unitCost)}</td>
        <td class="num">${formatNumber(l.lineTotal)}</td>
        <td class="check"></td>
      </tr>`,
    )
    .join("");
  printHtml(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<title>طلب شراء ${o.number}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font: 13px/1.5 Tahoma, "Segoe UI", Arial, sans-serif; color: #000; margin: 0; }
  h1 { font-size: 20px; margin: 0; }
  .head { display: flex; justify-content: space-between; align-items: flex-end;
          border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
  .meta div { margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #555; padding: 5px 6px; text-align: right; }
  th { background: #eee; }
  .num { direction: ltr; text-align: left; font-variant-numeric: tabular-nums; }
  .check { width: 60px; }
  .total { margin-top: 10px; text-align: left; font-size: 15px; font-weight: bold; }
  .note { margin-top: 10px; }
  .sign { margin-top: 40px; display: flex; justify-content: space-between; }
</style></head><body>
  <div class="head">
    <div><h1>${esc(shopName)}</h1><div>طلب شراء</div></div>
    <div class="meta">
      <div>رقم الطلب: <b>${o.number}</b></div>
      <div>التاريخ: ${esc(formatDate(o.createdAt))}</div>
      <div>المورد: <b>${esc(o.supplierName)}</b></div>
    </div>
  </div>
  <table>
    <thead><tr><th>#</th><th>الصنف</th><th>الكمية</th><th>الوحدة</th>
      <th>سعر تقديري</th><th>القيمة</th><th>تم التوريد</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total">الإجمالي التقديري: ${formatNumber(o.total)} ${esc(currencySymbol())}</div>
  ${o.note ? `<div class="note">ملاحظة: ${esc(o.note)}</div>` : ""}
  <div class="sign"><span>توقيع المستلم: ..................</span><span>توقيع المندوب: ..................</span></div>
</body></html>`);
}
