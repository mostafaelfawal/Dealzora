import type {
  SupplierDto,
  SupplierStatementDto,
  SuppliersSummaryDto,
  SupplierTransactionDto,
} from "../types/supplierApi";
import type {
  Supplier,
  SupplierStatementPage,
  SuppliersSummary,
  SupplierTransaction,
} from "../types/supplier";

export const MONEY_SCALE = 100; // قروش → جنيه

const money = (value: number) => value / MONEY_SCALE;

export const toSupplier = (dto: SupplierDto): Supplier => ({
  id: dto.id,
  name: dto.name,
  phone: dto.phone ?? "",
  address: dto.address ?? "",
  notes: dto.notes ?? "",
  balance: money(dto.balance),
  isActive: dto.is_active,
  version: dto.version,
  createdAt: dto.created_at,
});

export const toSummary = (dto: SuppliersSummaryDto): SuppliersSummary => ({
  total: dto.total,
  owed: dto.owed,
  inactive: dto.inactive,
  totalPayable: money(dto.total_payable),
});

export const toTransaction = (
  dto: SupplierTransactionDto,
): SupplierTransaction => ({
  id: dto.id,
  type: dto.txn_type,
  amount: money(dto.amount_delta),
  balanceAfter: money(dto.balance_after),
  note: dto.note ?? "",
  createdAt: dto.created_at,
});

export const toStatement = (
  dto: SupplierStatementDto,
): SupplierStatementPage => ({
  items: dto.items.map(toTransaction),
  total: dto.total,
  page: dto.page,
  pageSize: dto.page_size,
});
