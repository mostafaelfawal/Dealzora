/** نصوص حالات التحويل وموافقة الهاتف، والكميات (× 1000). منطق بلا React، ومُختبر. */
import type {
  CommandStatus,
  Transfer,
  TransferApproval,
  TransferLine,
  TransferStatus,
} from "@/api/types";
import { normalizeDigits } from "@/lib/format";

export const QTY_SCALE = 1000;

export const STATUS_LABEL: Record<TransferStatus, string> = {
  requested: "طلب ينتظر الرد",
  rejected: "مرفوض",
  withdrawn: "سحبه الطالب",
  sent: "في الطريق",
  received: "تم الاستلام",
  partial: "استُلم بعجز",
  cancelled: "ملغي",
};

export type Tone = "default" | "warning" | "success" | "destructive" | "muted";

export const STATUS_TONE: Record<TransferStatus, Tone> = {
  requested: "warning",
  rejected: "destructive",
  withdrawn: "muted",
  sent: "default",
  received: "success",
  partial: "warning",
  cancelled: "muted",
};

const APPROVAL_LABEL: Record<CommandStatus, string> = {
  pending: "وافقت من الهاتف، وتنتظر تنفيذ الفرع",
  executing: "الفرع ينفّذ الموافقة الآن",
  done: "نفّذ الفرع الموافقة",
  failed: "تعذّر على الفرع التنفيذ",
  superseded: "لم تُنفَّذ الموافقة",
  expired: "انتهت مهلة الموافقة",
  cancelled: "أُلغيت الموافقة",
};

/** «وافق owner من الهاتف · تنتظر تنفيذ الفرع» + السبب لو فشلت. null = لا يُعرض (اكتملت والتحويل أُرسل). */
export function approvalText(
  a: TransferApproval | null,
  status: TransferStatus,
): string | null {
  if (!a) return null;
  if (a.status === "done" && status !== "requested")
    return `وافق ${a.requested_by} من الهاتف`;
  const base =
    a.status === "pending"
      ? `وافق ${a.requested_by} من الهاتف، وتنتظر تنفيذ الفرع`
      : APPROVAL_LABEL[a.status];
  return a.error_message ? `${base}: ${a.error_message}` : base;
}

export const approvalBusy = (a: TransferApproval | null) =>
  a?.status === "pending" || a?.status === "executing";

/** 20000 ← «20»، 1500 ← «1.5» (أرقام لاتينية). */
export function formatQty(scaled: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(
    scaled / QTY_SCALE,
  );
}

/** الكمية المطلوبة في السطر (طلب) أو المرسلة (تحويل مباشر). */
export const lineQty = (l: TransferLine) => l.qty_requested ?? l.qty_sent;

/**
 * نص كمية من المستخدم ← × 1000. يقبل الأرقام العربية والفاصلة العشرية العربية.
 * null = غير صالح أو أكبر من المطلوب.
 */
export function parseQty(text: string, max: number): number | null {
  const cleaned = normalizeDigits(text)
    .replace(/٫/g, ".")
    .replace(/[,\s]/g, "");
  if (cleaned === "") return 0;
  if (!/^\d+(\.\d{1,3})?$/.test(cleaned)) return null;
  const scaled = Math.round(Number(cleaned) * QTY_SCALE);
  return scaled <= max ? scaled : null;
}

export function transferSummary(
  t: Pick<Transfer, "from_branch_name" | "to_branch_name" | "status">,
): string {
  return t.status === "requested"
    ? `${t.to_branch_name} يطلب من ${t.from_branch_name}`
    : `من ${t.from_branch_name} إلى ${t.to_branch_name}`;
}
