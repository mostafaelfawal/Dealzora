/** خطط التقسيط بشكل الواجهة (المال بالجنيه، التواريخ YYYY-MM-DD). */

export type Frequency = "monthly" | "biweekly" | "weekly";
export type PlanStatus = "active" | "completed" | "cancelled";
export type PlanFilter =
  "all" | "active" | "overdue" | "due_soon" | "completed" | "cancelled";
export type DueStatus = "paid" | "partial" | "overdue" | "upcoming";

export interface InstallmentPlan {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  title: string;
  principal: number;
  downPayment: number;
  /** المقسَّط فعلاً = الأصل − المقدّم (بلا أي زيادة). */
  total: number;
  installmentsCount: number;
  installmentAmount: number;
  frequency: Frequency;
  startDate: string;
  endDate: string;
  paidAmount: number;
  remaining: number;
  paidCount: number;
  overdueAmount: number;
  overdueCount: number;
  nextDueDate: string | null;
  nextDueAmount: number;
  status: PlanStatus;
  note: string | null;
  version: number;
  createdAt: number;
}

export interface DueRow {
  seq: number;
  dueDate: string;
  amount: number;
  paid: number;
  status: DueStatus;
}

export interface PlanPayment {
  id: string;
  amount: number;
  note: string | null;
  createdAt: number;
}

export interface InstallmentPlanDetail extends InstallmentPlan {
  schedule: DueRow[];
  payments: PlanPayment[];
}

export interface InstallmentsSummary {
  active: number;
  remaining: number;
  overduePlans: number;
  overdueAmount: number;
  dueSoonPlans: number;
  dueSoonAmount: number;
  completed: number;
  collected: number;
}

/** ما يرسله نموذج «خطة جديدة». */
export interface PlanInput {
  customerId: string;
  title: string;
  principal: number;
  downPayment: number;
  installmentsCount: number;
  frequency: Frequency;
  startDate: string;
  /** true = بيع/دين جديد يُضاف لحساب العميل. false = تقسيط مديونيته الحالية. */
  addsDebt: boolean;
  note: string;
}
