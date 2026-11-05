import { api } from "@/lib/axios";

import {
  toCreatePayload,
  toCustomer,
  toPaymentPayload,
  toStatementEntry,
  toUpdatePayload,
} from "../lib/customerMapper";
import type {
  Customer,
  CustomerInput,
  PaymentInput,
  StatementEntry,
} from "../types/customer";
import type {
  CustomerDto,
  CustomerListDto,
  StatementDto,
} from "../types/customerApi";
import { toBulkPayload, type BulkItem, type BulkResultDto } from "@/lib/bulk";

/** أقصى page_size يقبله الـ backend (MAX_PAGE_SIZE). */
const PAGE_SIZE = 500;

const getCustomersPage = async (page: number) =>
  (
    await api.get<CustomerListDto>("/customers", {
      params: { page, page_size: PAGE_SIZE },
    })
  ).data;

/**
 * يجلب كل العملاء (الفلترة والبحث على جهة العميل حالياً).
 * لو كبرت القاعدة: انقل الفلترة للسيرفر مثل products (q / filter / sort / page).
 */
export const fetchCustomers = async (): Promise<Customer[]> => {
  const first = await getCustomersPage(1);
  const items = [...first.items];
  const pages = Math.ceil(first.total / PAGE_SIZE);
  for (let page = 2; page <= pages; page++) {
    items.push(...(await getCustomersPage(page)).items);
  }
  return items.map(toCustomer);
};

/** كشف الحساب مرتباً من الأقدم للأحدث (الـ backend يرجّع الأحدث أولاً). */
export const fetchStatement = async (id: string): Promise<StatementEntry[]> => {
  const { data } = await api.get<StatementDto>(`/customers/${id}/statement`, {
    params: { page: 1, page_size: PAGE_SIZE },
  });
  return data.items.map(toStatementEntry).reverse();
};

/** id موجود = تعديل (يحتاج baseVersion)، وغيابه = إضافة. */
export const saveCustomer = async (
  input: CustomerInput,
  id?: string | null,
  baseVersion?: number,
): Promise<Customer> => {
  if (id) {
    if (baseVersion === undefined) throw new Error("baseVersion مطلوب للتعديل");
    const { data } = await api.put<CustomerDto>(
      `/customers/${id}`,
      toUpdatePayload(input, baseVersion),
    );
    return toCustomer(data);
  }
  const { data } = await api.post<CustomerDto>(
    "/customers",
    toCreatePayload(input),
  );
  return toCustomer(data);
};

export const toggleCustomerActive = async (id: string, baseVersion: number) =>
  toCustomer(
    (
      await api.post<CustomerDto>(`/customers/${id}/toggle-active`, null, {
        params: { base_version: baseVersion },
      })
    ).data,
  );

export const deleteCustomer = async (id: string, baseVersion: number) => {
  await api.delete(`/customers/${id}`, {
    params: { base_version: baseVersion },
  });
};

export const collectPayment = async (id: string, payment: PaymentInput) =>
  toCustomer(
    (
      await api.post<CustomerDto>(
        `/customers/${id}/payments`,
        toPaymentPayload(payment),
      )
    ).data,
  );

export const bulkDeleteCustomers = async (items: BulkItem[]) =>
  (
    await api.post<BulkResultDto>(
      "/customers/bulk-delete",
      toBulkPayload(items),
    )
  ).data;

export const bulkDeactivateCustomers = async (items: BulkItem[]) =>
  (
    await api.post<BulkResultDto>(
      "/customers/bulk-deactivate",
      toBulkPayload(items),
    )
  ).data;
