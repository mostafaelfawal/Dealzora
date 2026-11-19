import { formatMoneyText } from "@/lib/format";
import {
  buildPdfDocument,
  collectAppCss,
  saveHtmlAsPdf,
} from "@/lib/pdfDocument";
import type { SavedFile } from "@/lib/saveFile";
import { openWhatsapp } from "@/lib/whatsapp";
import { toWhatsappNumber } from "@/features/sales/lib/receipt";

import { STATEMENT_TYPE_LABEL } from "../config/statementOptions";
import type { Customer, StatementEntry } from "../types/customer";
import { formatDate } from "./customerCalc";

/**
 * كشف حساب العميل كملف PDF بحجم A4 يُرسل له على واتساب.
 *
 * روابط wa.me تحمل نصاً فقط ولا ترفق ملفات، لذلك: نحفظ الملف في التنزيلات، ثم نفتح محادثة
 * العميل برسالة جاهزة، ويسحب التاجر الملف إلى المحادثة بنفسه.
 */

const esc = (text: string) =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** الرصيد بلغة العميل: موجب = عليه، سالب = له. */
function balanceText(balance: number): string {
  if (balance > 0) return `${formatMoneyText(balance)} عليه`;
  if (balance < 0) return `${formatMoneyText(-balance)} له`;
  return formatMoneyText(0);
}

const STATEMENT_CSS = `
.st-info { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
.st-box { border: 1px solid #ddd; padding: 8px 10px; }
.st-box .k { font-size: 10px; color: #666; margin: 0 0 3px; }
.st-box .v { font-size: 13px; font-weight: 700; margin: 0; }
.st-box .v.debt { color: #b42318; }
.st-box .v.credit { color: #067647; }
.st-table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
.st-table th { background: #f3f4f6; font-weight: 600; text-align: start; }
.st-table th, .st-table td { border: 1px solid #e5e7eb; padding: 4px 6px; }
.st-table td.num { white-space: nowrap; font-variant-numeric: tabular-nums; }
.st-table tfoot td { font-weight: 700; background: #f9fafb; }
.st-note { margin-top: 10px; font-size: 9.5px; color: #666; }
`;

function statementHtml(customer: Customer, entries: StatementEntry[]): string {
  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  const balanceClass =
    customer.balance > 0 ? "debt" : customer.balance < 0 ? "credit" : "";

  const rows = entries
    .map(
      (e) => `<tr>
  <td class="num">${esc(formatDate(e.date))}</td>
  <td>${esc(STATEMENT_TYPE_LABEL[e.type])}</td>
  <td>${esc(e.ref || "—")}</td>
  <td class="num">${e.debit > 0 ? esc(formatMoneyText(e.debit)) : "—"}</td>
  <td class="num">${e.credit > 0 ? esc(formatMoneyText(e.credit)) : "—"}</td>
  <td class="num">${esc(balanceText(e.balance))}</td>
</tr>`,
    )
    .join("");

  return `<style>${STATEMENT_CSS}</style>
<div class="st-info pdf-avoid">
  <div class="st-box"><p class="k">العميل</p><p class="v">${esc(customer.name)}</p></div>
  <div class="st-box"><p class="k">رقم الهاتف</p><p class="v" dir="ltr" style="text-align:end">${esc(customer.phone || "—")}</p></div>
  <div class="st-box"><p class="k">الرصيد الحالي</p><p class="v ${balanceClass}">${esc(balanceText(customer.balance))}</p></div>
</div>
<table class="st-table">
  <thead><tr>
    <th>التاريخ</th><th>البيان</th><th>المرجع</th><th>عليه</th><th>له</th><th>الرصيد</th>
  </tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr>
    <td colspan="3">الإجمالي (${entries.length} حركة)</td>
    <td class="num">${esc(formatMoneyText(totalDebit))}</td>
    <td class="num">${esc(formatMoneyText(totalCredit))}</td>
    <td class="num">${esc(balanceText(customer.balance))}</td>
  </tr></tfoot>
</table>
<p class="st-note">«عليه» = ما يزيد مديونية العميل، و«له» = ما يُنقصها. الرصيد بعد كل حركة.</p>`;
}

const fileDate = () => new Date().toISOString().slice(0, 10);

/**
 * يجهّز الكشف ويحفظه PDF في التنزيلات.
 * @param entries الحركات من الأقدم للأحدث.
 * @returns الملف المحفوظ، أو null في المتصفح (تُفتح نافذة الطباعة بدلاً منه).
 */
export async function saveStatementPdf({
  customer,
  entries,
  shopName,
  generatedBy,
}: {
  customer: Customer;
  entries: StatementEntry[];
  shopName: string;
  generatedBy?: string;
}): Promise<SavedFile | null> {
  const today = formatDate(Date.now());
  const periodLabel = entries.length
    ? `من ${formatDate(entries[0].date)} حتى ${today}`
    : `حتى ${today}`;
  const html = buildPdfDocument({
    shopName,
    title: `كشف حساب ${customer.name}`,
    periodLabel,
    generatedBy,
    sections: [
      { title: "حركات الحساب", html: statementHtml(customer, entries) },
    ],
    appCss: await collectAppCss(),
  });
  return saveHtmlAsPdf(html, `كشف حساب ${customer.name} ${fileDate()}.pdf`);
}

export function buildStatementWhatsappText(
  customer: Customer,
  shopName: string,
): string {
  const status =
    customer.balance > 0
      ? `الرصيد المستحق عليكم: *${formatMoneyText(customer.balance)}*`
      : customer.balance < 0
        ? `رصيدكم لدينا: *${formatMoneyText(-customer.balance)}*`
        : "لا يوجد رصيد مستحق على حسابكم.";
  return [
    `*${shopName}*`,
    `مرحباً ${customer.name}،`,
    `مرفق كشف حسابكم لدينا حتى ${formatDate(Date.now())}.`,
    status,
    "",
    "شكراً لتعاملكم معنا.",
  ].join("\n");
}

/** يفتح محادثة العميل على واتساب برسالة الكشف. بدون رقم يختار التاجر جهة الاتصال. */
export async function sendStatementWhatsapp(
  customer: Customer,
  shopName: string,
): Promise<void> {
  const number = customer.phone ? toWhatsappNumber(customer.phone) : null;
  await openWhatsapp(
    number ?? "",
    buildStatementWhatsappText(customer, shopName),
  );
}
