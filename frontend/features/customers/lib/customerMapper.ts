import type {
  Customer,
  CustomerInput,
  PaymentInput,
  StatementEntry,
} from "../types/customer";
import type {
  CustomerCreatePayload,
  CustomerDto,
  CustomerUpdatePayload,
  PaymentPayload,
  StatementEntryDto,
} from "../types/customerApi";

/** قروش (backend) ⇄ جنيه (الواجهة). */
export const toPounds = (cents: number) => cents / 100;
export const toCents = (pounds: number) => Math.round(pounds * 100);

/** SQLite يرجّع datetime بدون منطقة زمنية (UTC)، فنضيف Z عند غيابها. */
const HAS_TZ = /(Z|[+-]\d{2}:?\d{2})$/i;
export const toMs = (iso: string): number =>
  Date.parse(HAS_TZ.test(iso) ? iso : `${iso}Z`);
const toMsOrNull = (iso: string | null) => (iso ? toMs(iso) : null);

export const toCustomer = (dto: CustomerDto): Customer => ({
  id: dto.id,
  name: dto.name,
  phone: dto.phone ?? "",
  address: dto.address,
  notes: dto.notes ?? "",
  balance: toPounds(dto.balance),
  creditLimit: toPounds(dto.credit_limit),
  isActive: dto.is_active,
  totalSales: toPounds(dto.total_sales ?? 0),
  lastPurchaseAt: toMsOrNull(dto.last_purchase_at),
  lastPaymentAt: toMsOrNull(dto.last_payment_at),
  createdAt: toMs(dto.created_at),
  version: dto.version,
});

export const toStatementEntry = (dto: StatementEntryDto): StatementEntry => ({
  id: dto.id,
  date: toMs(dto.created_at),
  type: dto.entry_type,
  ref: dto.note ?? "—",
  debit: toPounds(dto.debit),
  credit: toPounds(dto.credit),
  balance: toPounds(dto.balance_after),
});

export const toCreatePayload = (input: CustomerInput): CustomerCreatePayload => ({
  name: input.name,
  phone: input.phone,
  address: input.address,
  notes: input.notes,
  credit_limit: toCents(input.creditLimit),
  opening_balance: toCents(input.openingBalance),
  is_active: input.isActive,
});

/** التعديل لا يقبل opening_balance (الـ backend extra="forbid"). */
export const toUpdatePayload = (
  input: CustomerInput,
  baseVersion: number,
): CustomerUpdatePayload => ({
  name: input.name,
  phone: input.phone,
  address: input.address,
  notes: input.notes,
  credit_limit: toCents(input.creditLimit),
  is_active: input.isActive,
  base_version: baseVersion,
});

export const toPaymentPayload = (p: PaymentInput): PaymentPayload => ({
  amount: toCents(p.amount),
  note: p.note.trim() || null,
});