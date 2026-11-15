import type { EReceiptStatus } from "../types/eta";

/** تسميات حالة الإيصال ولونها (للشاشة والكاشير وتفاصيل الفاتورة). */
export const RECEIPT_STATUS: Record<
  EReceiptStatus,
  { label: string; tone: string }
> = {
  not_sent: { label: "لم يُرسل", tone: "bg-muted text-foreground" },
  pending: { label: "معلّق", tone: "bg-primary/10 text-primary" },
  accepted: { label: "مقبول", tone: "bg-success/10 text-success" },
  rejected: { label: "مرفوض", tone: "bg-destructive/10 text-destructive" },
  not_required: { label: "غير مطلوب", tone: "bg-muted text-muted-foreground" },
  invalid: { label: "خطأ تحقق", tone: "bg-warning/10 text-warning" },
};

export const RESEND_LABEL = {
  correct: "تصحيح وإعادة إرسال",
  regenerate: "إعادة توليد",
  send: "إرسال الآن",
} as const;
