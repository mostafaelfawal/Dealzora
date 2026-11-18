import { cleanParams, toCents, toMs, toPounds } from "@/lib/apiMap";
import { api } from "@/lib/axios";

import type {
  DueStatus,
  Frequency,
  InstallmentPlan,
  InstallmentPlanDetail,
  InstallmentsSummary,
  PlanFilter,
  PlanInput,
  PlanStatus,
} from "../types/installment";

/** شكل backend/app/modules/installments/schema.py (المال بالقروش). */
interface PlanDto {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
  title: string;
  principal: number;
  down_payment: number;
  total: number;
  installments_count: number;
  installment_amount: number;
  frequency: Frequency;
  start_date: string;
  end_date: string;
  paid_amount: number;
  remaining: number;
  paid_count: number;
  overdue_amount: number;
  overdue_count: number;
  next_due_date: string | null;
  next_due_amount: number;
  status: PlanStatus;
  note: string | null;
  version: number;
  created_at: string;
}

interface PlanDetailDto extends PlanDto {
  schedule: {
    seq: number;
    due_date: string;
    amount: number;
    paid: number;
    status: DueStatus;
  }[];
  payments: {
    id: string;
    amount: number;
    note: string | null;
    created_at: string;
  }[];
}

interface SummaryDto {
  active: number;
  remaining: number;
  overdue_plans: number;
  overdue_amount: number;
  due_soon_plans: number;
  due_soon_amount: number;
  completed: number;
  collected: number;
}

const toPlan = (d: PlanDto): InstallmentPlan => ({
  id: d.id,
  customerId: d.customer_id,
  customerName: d.customer_name,
  customerPhone: d.customer_phone,
  title: d.title,
  principal: toPounds(d.principal),
  downPayment: toPounds(d.down_payment),
  total: toPounds(d.total),
  installmentsCount: d.installments_count,
  installmentAmount: toPounds(d.installment_amount),
  frequency: d.frequency,
  startDate: d.start_date,
  endDate: d.end_date,
  paidAmount: toPounds(d.paid_amount),
  remaining: toPounds(d.remaining),
  paidCount: d.paid_count,
  overdueAmount: toPounds(d.overdue_amount),
  overdueCount: d.overdue_count,
  nextDueDate: d.next_due_date,
  nextDueAmount: toPounds(d.next_due_amount),
  status: d.status,
  note: d.note,
  version: d.version,
  createdAt: toMs(d.created_at),
});

const toDetail = (d: PlanDetailDto): InstallmentPlanDetail => ({
  ...toPlan(d),
  schedule: d.schedule.map((r) => ({
    seq: r.seq,
    dueDate: r.due_date,
    amount: toPounds(r.amount),
    paid: toPounds(r.paid),
    status: r.status,
  })),
  payments: d.payments.map((p) => ({
    id: p.id,
    amount: toPounds(p.amount),
    note: p.note,
    createdAt: toMs(p.created_at),
  })),
});

const toBody = (i: PlanInput) => ({
  customer_id: i.customerId,
  title: i.title.trim(),
  principal: toCents(i.principal),
  down_payment: toCents(i.downPayment),
  installments_count: i.installmentsCount,
  frequency: i.frequency,
  start_date: i.startDate,
  adds_debt: i.addsDebt,
  note: i.note.trim() || null,
});

export const fetchPlans = async (
  filter: PlanFilter = "all",
): Promise<InstallmentPlan[]> =>
  (
    await api.get<PlanDto[]>("/installments", {
      params: cleanParams({ filter }),
    })
  ).data.map(toPlan);

export const fetchPlansSummary = async (): Promise<InstallmentsSummary> => {
  const { data } = await api.get<SummaryDto>("/installments/summary");
  return {
    active: data.active,
    remaining: toPounds(data.remaining),
    overduePlans: data.overdue_plans,
    overdueAmount: toPounds(data.overdue_amount),
    dueSoonPlans: data.due_soon_plans,
    dueSoonAmount: toPounds(data.due_soon_amount),
    completed: data.completed,
    collected: toPounds(data.collected),
  };
};

export const fetchPlan = async (id: string): Promise<InstallmentPlanDetail> =>
  toDetail((await api.get<PlanDetailDto>(`/installments/${id}`)).data);

export const createPlan = async (input: PlanInput) =>
  toDetail(
    (await api.post<PlanDetailDto>("/installments", toBody(input))).data,
  );

export const payInstallment = async (
  id: string,
  payment: { amount: number; note: string },
) =>
  toDetail(
    (
      await api.post<PlanDetailDto>(`/installments/${id}/payments`, {
        amount: toCents(payment.amount),
        note: payment.note.trim() || null,
      })
    ).data,
  );

export const cancelPlan = async (p: InstallmentPlan) =>
  toDetail(
    (
      await api.post<PlanDetailDto>(`/installments/${p.id}/cancel`, null, {
        params: { base_version: p.version },
      })
    ).data,
  );
