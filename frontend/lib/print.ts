import { invoke, isTauri } from "@tauri-apps/api/core";
import { toast } from "sonner";

import { bytesToBase64, canvasToEscPos } from "./escpos";
import { renderHtmlToCanvas } from "./htmlRaster";
import { getPrinterPrefs } from "./printerPrefs";

/**
 * يطبع مستند HTML مستقل عبر iframe مخفي (نافذة الطباعة الأصلية للنظام،
 * تشمل الطابعة الحرارية وطابعة الملصقات). مقاس الورق يحدده @page داخل المستند.
 */
export function printHtml(html: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;opacity:0;";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc || !frame.contentWindow) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  const win = frame.contentWindow;
  const cleanup = () => setTimeout(() => frame.remove(), 1000);
  win.addEventListener("afterprint", cleanup, { once: true });
  // ننتظر رسم الصفحة قبل الطباعة.
  setTimeout(() => {
    win.focus();
    win.print();
    cleanup();
  }, 50);
}

/* ---------- الطباعة الحرارية المباشرة (بدون نافذة الطباعة) ---------- */

export interface PrinterInfo {
  name: string;
  is_default: boolean;
}

export const canPrintDirect = () => isTauri();

export const listPrinters = () => invoke<PrinterInfo[]>("list_printers");

/** مهام الطباعة بالترتيب (مثلاً إيصال المرتجع ثم فاتورة الاستبدال). */
let queue: Promise<unknown> = Promise.resolve();

async function sendToPrinter(
  html: string,
  printer: string,
  jobName: string,
  openDrawer: boolean,
) {
  const prefs = getPrinterPrefs();
  const canvas = await renderHtmlToCanvas(html, prefs.paperMm);
  const bytes = canvasToEscPos(canvas, {
    cut: prefs.cut,
    feedLines: prefs.feedLines,
    openDrawer: openDrawer && prefs.openDrawer,
  });
  await invoke("print_raw", {
    printer,
    data: bytesToBase64(bytes),
    jobName,
  });
}

/**
 * يطبع إيصالاً (بيع/مرتجع) على الطابعة الحرارية المختارة فوراً بدون نافذة.
 * بدون طابعة مختارة، أو خارج البرنامج (المتصفح)، أو في وضع «نافذة الطباعة»، أو فاتورة A4:
 * نافذة الطباعة العادية (ويندوز يتذكر آخر طابعة اختارها التاجر فيها).
 */
export function printReceiptHtml(
  html: string,
  opts: { jobName: string; openDrawer?: boolean },
): Promise<void> {
  const prefs = getPrinterPrefs();
  if (prefs.kind === "a4") return printA4(html, opts.jobName);
  if (!canPrintDirect() || prefs.mode === "dialog") {
    printHtml(html);
    return Promise.resolve();
  }
  const printer = prefs.printer;
  if (!printer) {
    toast.info("لم تُختر طابعة الإيصالات بعد", {
      description:
        "اخترها من الإعدادات ← الطباعة والفاتورة لتطبع مباشرة بدون نافذة.",
      duration: 6000,
    });
    printHtml(html);
    return Promise.resolve();
  }
  const job = queue.then(() =>
    sendToPrinter(html, printer, opts.jobName, Boolean(opts.openDrawer)).catch(
      (e: unknown) => {
        toast.error("تعذّرت الطباعة على الطابعة الحرارية", {
          description: typeof e === "string" ? e : (e as Error)?.message,
          duration: 10_000,
          action: { label: "طباعة عادية", onClick: () => printHtml(html) },
        });
      },
    ),
  );
  queue = job;
  return job;
}

/* ---------- فاتورة A4: طباعة فورية على الطابعة المختارة (بدون نافذة) ---------- */

const A4_ERRORS: Record<string, string> = {
  printer_unavailable: "الطابعة غير متاحة الآن. تأكد أنها موصّلة وتعمل.",
  webview2_print_unsupported:
    "الطباعة الفورية تحتاج تحديث Microsoft Edge WebView2 على هذا الجهاز.",
  print_timeout: "الطابعة لم تستجب. تأكد أنها موصّلة وتعمل.",
};

/**
 * فاتورة A4 على طابعة هذا الجهاز فوراً (Rust: a4print.rs يطبع بنفس محرك العرض).
 * بدون طابعة مختارة، أو خارج البرنامج، أو وضع «نافذة الطباعة»: نافذة الطباعة العادية.
 */
function printA4(html: string, jobName: string): Promise<void> {
  const prefs = getPrinterPrefs();
  if (!canPrintDirect() || prefs.a4Mode === "dialog") {
    printHtml(html);
    return Promise.resolve();
  }
  const printer = prefs.a4Printer;
  if (!printer) {
    toast.info("لم تُختر طابعة الفواتير A4 بعد", {
      description:
        "اخترها من الإعدادات ← الطباعة والفاتورة لتطبع فوراً بدون نافذة.",
      duration: 6000,
    });
    printHtml(html);
    return Promise.resolve();
  }
  const job = queue.then(() =>
    invoke("print_html_silent", { html, printer, jobName }).catch(
      (e: unknown) => {
        const code = typeof e === "string" ? e : (e as Error)?.message;
        toast.error("تعذّرت طباعة الفاتورة على " + printer, {
          description: A4_ERRORS[code ?? ""] ?? code,
          duration: 10_000,
          action: { label: "طباعة عادية", onClick: () => printHtml(html) },
        });
      },
    ),
  );
  queue = job;
  return job.then(() => undefined);
}
