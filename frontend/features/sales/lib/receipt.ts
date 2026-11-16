import { invoke, isTauri } from "@tauri-apps/api/core";
import { toast } from "sonner";

import { formatDateTime } from "@/lib/dates";
import { getCachedPlan, upgradeMessage } from "@/lib/plan";
import { printReceiptHtml } from "@/lib/print";
import { getPrinterPrefs } from "@/lib/printerPrefs";
import { getReceiptConfig } from "@/lib/receiptConfig";
import { getCurrency } from "@/lib/currency";
import {
  activeRate,
  formatSecond,
  getExchange,
  rateSentence,
} from "@/lib/exchange";
import { currencySymbol } from "@/lib/currency";
import { formatQty } from "@/lib/format";

import { RETURN_REASON_LABEL } from "../config/saleOptions";
import { fetchReturn, fetchSale } from "../api/sales.api";
import type { Sale, SaleReturn } from "../types/sale";
import {
  esc,
  money,
  renderReceipt,
  type DocRow,
  type ReceiptModel,
  type RenderOptions,
} from "./receiptDocument";
import { saleTaxRows } from "./saleTax";

const FOOTER = "شكراً لزيارتكم";
const EG_COUNTRY = "20";

/** إعدادات الرسم الحالية لهذا الجهاز (نوع الطابعة وعرض الورق) وشكل الفاتورة للمحل. */
function currentRender(
  shopName: string,
  override?: Partial<RenderOptions>,
): RenderOptions {
  const prefs = getPrinterPrefs();
  return {
    kind: prefs.kind,
    paperMm: prefs.paperMm,
    config: getReceiptConfig(),
    shopName,
    freePlan: Boolean(getCachedPlan()?.isFree),
    ...override,
  };
}

/**
 * الإجمالي بالعملة الثانية وسعر الصرف المستخدم (لو مفعّلة للفاتورة).
 * بسعر وقت الطباعة، والسعر مكتوب في الفاتورة نفسها حتى يكون واضحاً للزبون.
 */
function secondCurrencyRows(total: number): DocRow[] {
  const ex = getExchange();
  const rate = activeRate(ex);
  if (!ex.config.showOnReceipt || !rate) return [];
  const value = formatSecond(total, ex);
  if (!value) return [];
  return [
    { label: `الإجمالي بـ${ex.config.name}`, value: esc(value) },
    {
      label: "سعر الصرف",
      value: esc(rateSentence(rate, getCurrency(), ex.config).text),
    },
  ];
}

export function saleReceiptModel(sale: Sale, reprint = false): ReceiptModel {
  const discount = sale.invoiceDiscount + sale.linesDiscount;
  const totals: DocRow[] = [
    { label: "الإجمالي قبل الخصم", value: money(sale.subtotal) },
  ];
  if (sale.promoDiscount > 0)
    totals.push({ label: "العروض", value: money(sale.promoDiscount) });
  if (discount > 0) totals.push({ label: "الخصم", value: money(discount) });
  if (sale.loyaltyDiscount > 0)
    totals.push({
      label: `خصم ${sale.loyaltyRedeemed} نقطة`,
      value: money(sale.loyaltyDiscount),
    });
  for (const r of saleTaxRows(sale))
    totals.push({ label: r.label, value: money(r.amount) });

  const payments: DocRow[] = [
    { label: "طريقة الدفع", value: esc(sale.paymentLabel) },
  ];
  if (sale.cashAmount > 0)
    payments.push({
      label: "المدفوع نقداً",
      value: money(sale.received || sale.cashAmount),
    });
  if (sale.change > 0)
    payments.push({ label: "الباقي", value: money(sale.change) });
  if (sale.creditAmount > 0)
    payments.push({ label: "آجل على الحساب", value: money(sale.creditAmount) });
  if (sale.walletAmount > 0)
    payments.push({
      label: `مدفوع ${sale.paymentLabel}`,
      value: money(sale.walletAmount),
    });
  if (sale.walletAmount > 0 && sale.paymentRef)
    payments.push({ label: "رقم العملية", value: esc(sale.paymentRef) });
  // رصيد العميل لدى المحل: ما دُفع منه، وما تُرك من الباقي، ورصيده بعد الفاتورة.
  if (sale.balanceUsed > 0)
    payments.push({
      label: "من رصيدك لدى المحل",
      value: money(sale.balanceUsed),
    });
  if (sale.changeKept > 0)
    payments.push({
      label: "تُرك من الباقي رصيداً",
      value: money(sale.changeKept),
    });
  if (
    (sale.balanceUsed > 0 || sale.changeKept > 0) &&
    sale.customerBalance !== null
  )
    payments.push(
      sale.customerBalance > 0
        ? { label: "المتبقي عليك", value: money(sale.customerBalance) }
        : {
            label: "رصيدك لدى المحل الآن",
            value: money(-sale.customerBalance),
          },
    );
  if (sale.returnedTotal > 0)
    payments.push({
      label: "مرتجع من الفاتورة",
      value: money(sale.returnedTotal),
    });

  const notes: string[] = [];
  if (
    sale.customerPoints !== null &&
    (sale.loyaltyEarned > 0 || sale.loyaltyRedeemed > 0)
  )
    notes.push(
      `كسبت ${sale.loyaltyEarned} نقطة · رصيدك ${sale.customerPoints} نقطة`,
    );

  return {
    kind: "sale",
    title: "فاتورة بيع",
    number: sale.number,
    reference: null,
    date: sale.soldAt,
    reprint,
    cashier: sale.cashierName,
    customer: sale.customerName,
    customerPhone: sale.customerPhone,
    lines: sale.lines.map((l) => ({
      name: l.name,
      qty: l.qty,
      unit: l.unitName,
      unitPrice: l.unitPrice,
      discount: [
        l.promoDiscount > 0
          ? `${l.promoName ?? "عرض"} −${money(l.promoDiscount)}`
          : "",
        l.discount > 0 ? `خصم ${money(l.discount)}` : "",
      ]
        .filter(Boolean)
        .join(" "),
      total: l.lineTotal,
    })),
    totals,
    grandLabel: "الإجمالي",
    grand: sale.total,
    alt: secondCurrencyRows(sale.total),
    payments,
    notes,
    eta: sale.etaPrint,
  };
}

export function returnReceiptModel(ret: SaleReturn): ReceiptModel {
  const totals: DocRow[] = [];
  if (ret.taxTotal)
    totals.push({
      label: "منها ضريبة القيمة المضافة",
      value: money(ret.taxTotal),
    });
  const payments: DocRow[] = [];
  if (ret.cashRefund > 0)
    payments.push({ label: "رُد نقداً", value: money(ret.cashRefund) });
  if (ret.walletRefund > 0)
    payments.push({ label: "حُوّل للمحفظة", value: money(ret.walletRefund) });
  if (ret.balanceRefund > 0)
    payments.push({
      label: "أُضيف لرصيدك لدى المحل",
      value: money(ret.balanceRefund),
    });
  if (ret.creditRefund > 0)
    payments.push({
      label: "خُصم من حساب العميل",
      value: money(ret.creditRefund),
    });
  const notes = [`السبب: ${RETURN_REASON_LABEL[ret.reason]}`];
  if (ret.note) notes.push(`ملاحظة: ${ret.note}`);

  return {
    kind: "return",
    title: "إيصال مرتجع",
    number: ret.number,
    reference: `من فاتورة ${ret.saleNumber}`,
    date: ret.returnedAt,
    reprint: false,
    cashier: ret.cashierName,
    customer: ret.customerName,
    customerPhone: null,
    lines: ret.lines.map((l) => ({
      name: l.name,
      qty: l.qty,
      unit: l.unitName,
      unitPrice: null,
      discount: "",
      total: l.amount,
    })),
    totals,
    grandLabel: "قيمة المرتجع",
    grand: ret.total,
    alt: secondCurrencyRows(ret.total),
    payments,
    notes,
    eta: ret.etaPrint,
  };
}

/** HTML الفاتورة بشكل طابعة هذا الجهاز (حراري/A4). override للمعاينة في الإعدادات. */
export function buildReceiptHtml(
  sale: Sale,
  shopName: string,
  reprint = false,
  override?: Partial<RenderOptions>,
): string {
  return renderReceipt(
    saleReceiptModel(sale, reprint),
    currentRender(shopName, override),
  );
}

export function buildReturnReceiptHtml(
  ret: SaleReturn,
  shopName: string,
  override?: Partial<RenderOptions>,
): string {
  return renderReceipt(
    returnReceiptModel(ret),
    currentRender(shopName, override),
  );
}

/**
 * يطبع إيصال البيع: مباشرة على الطابعة الحرارية لو مختارة، وإلا بنافذة الطباعة.
 * openDrawer: بعد البيع فقط (ليس عند إعادة الطباعة)، ويفتح الدرج لو فيه نقدية.
 */
export async function printReceipt(
  sale: Sale,
  shopName: string,
  opts: { reprint?: boolean; openDrawer?: boolean } = {},
) {
  // من قائمة (بلا بيانات الطباعة) لفاتورة لها إيصال إلكتروني: نجلبها كاملة حتى يُطبع الـ QR.
  if (sale.etaUuid && !sale.etaPrint)
    sale = await fetchSale(sale.id).catch(() => sale);
  return printReceiptHtml(buildReceiptHtml(sale, shopName, opts.reprint), {
    jobName: `فاتورة ${sale.number}`,
    openDrawer: Boolean(opts.openDrawer) && sale.cashAmount > 0,
  });
}

export async function printReturnReceipt(
  ret: SaleReturn,
  shopName: string,
  opts: { openDrawer?: boolean } = {},
) {
  if (ret.etaUuid && !ret.etaPrint)
    ret = await fetchReturn(ret.id).catch(() => ret);
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
    sale.etaPrint
      ? `الإيصال الإلكتروني (${sale.etaPrint.uuid.slice(0, 12)}…): ${sale.etaPrint.qrUrl}`
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
