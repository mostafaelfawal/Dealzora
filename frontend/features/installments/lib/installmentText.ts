import { normalizeSearch } from "@/features/pos/lib/posCalc";
import { formatDate, parseIsoDay } from "@/lib/dates";

import type {
  DueStatus,
  Frequency,
  InstallmentPlan,
  PlanFilter,
  PlanStatus,
} from "../types/installment";

export const FREQUENCIES: readonly { id: Frequency; label: string }[] = [
  { id: "monthly", label: "شهري" },
  { id: "biweekly", label: "كل أسبوعين" },
  { id: "weekly", label: "أسبوعي" },
];

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  monthly: "شهرياً",
  biweekly: "كل أسبوعين",
  weekly: "أسبوعياً",
};

export const COUNT_PRESETS = [3, 6, 10, 12, 18, 24] as const;

export const PLAN_FILTERS: readonly { id: PlanFilter; label: string }[] = [
  { id: "all", label: "الكل" },
  { id: "active", label: "جارية" },
  { id: "overdue", label: "متأخرة" },
  { id: "due_soon", label: "تستحق هذا الأسبوع" },
  { id: "completed", label: "مكتملة" },
  { id: "cancelled", label: "ملغاة" },
];

/** حالة الخطة كما تظهر على البطاقة (المتأخرة لها لونها حتى لو «جارية»). */
export function planBadge(p: InstallmentPlan): {
  label: string;
  className: string;
} {
  if (p.status === "completed")
    return { label: "مكتملة", className: "bg-success/10 text-success" };
  if (p.status === "cancelled")
    return { label: "ملغاة", className: "bg-muted text-muted-foreground" };
  if (p.overdueCount > 0)
    return {
      label:
        p.overdueCount === 1 ? "قسط متأخر" : `${p.overdueCount} أقساط متأخرة`,
      className: "bg-destructive/10 text-destructive",
    };
  return { label: "جارية", className: "bg-primary/10 text-primary" };
}

export const STATUS_LABEL: Record<PlanStatus, string> = {
  active: "جارية",
  completed: "مكتملة",
  cancelled: "ملغاة",
};

export const DUE_INFO: Record<DueStatus, { label: string; className: string }> =
  {
    paid: { label: "مدفوع", className: "bg-success/10 text-success" },
    partial: { label: "مدفوع جزئياً", className: "bg-warning/15 text-warning" },
    overdue: {
      label: "متأخر",
      className: "bg-destructive/10 text-destructive",
    },
    upcoming: { label: "لم يحن", className: "bg-muted text-muted-foreground" },
  };

export const isoDate = (iso: string) => formatDate(parseIsoDay(iso));

/** «اليوم» / «غداً» / «بعد 5 أيام» / «متأخر 3 أيام». */
export function relativeDue(iso: string, now = new Date()): string {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((parseIsoDay(iso) - today.getTime()) / 86_400_000);
  if (days === 0) return "اليوم";
  if (days === 1) return "غداً";
  if (days === -1) return "منذ أمس";
  if (days > 0) return days <= 10 ? `بعد ${days} أيام` : `بعد ${days} يوماً`;
  const late = -days;
  return late <= 10 ? `متأخر ${late} أيام` : `متأخر ${late} يوماً`;
}

/** يطابق البحث في القائمة: اسم العميل أو هاتفه أو عنوان الخطة. q مُطبَّع بـ normalizeSearch. */
export function matchesPlan(p: InstallmentPlan, q: string): boolean {
  if (!q) return true;
  return (
    normalizeSearch(p.customerName).includes(q) ||
    normalizeSearch(p.title).includes(q) ||
    (p.customerPhone ?? "").includes(q)
  );
}

export function matchesFilter(
  p: InstallmentPlan,
  f: PlanFilter,
  todayIso: string,
  weekIso: string,
): boolean {
  switch (f) {
    case "all":
      return true;
    case "active":
      return p.status === "active";
    case "overdue":
      return p.status === "active" && p.overdueCount > 0;
    case "due_soon":
      return (
        p.status === "active" &&
        p.overdueCount === 0 &&
        p.nextDueDate !== null &&
        p.nextDueDate >= todayIso &&
        p.nextDueDate <= weekIso
      );
    case "completed":
      return p.status === "completed";
    case "cancelled":
      return p.status === "cancelled";
  }
}
