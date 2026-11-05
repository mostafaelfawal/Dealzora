import { normalizeDigits } from "@/lib/format";

import { cleanPhone, isOverdue } from "./customerCalc";
import { getCreditLevel } from "./customerCalc";
import type {
  Customer,
  CustomerFilters,
  CustomerSortKey,
  CustomersSummary,
} from "../types/customer";

export function summarize(customers: Customer[], now = Date.now()): CustomersSummary {
  const summary: CustomersSummary = {
    total: customers.length,
    totalDebt: 0,
    debtors: 0,
    overdue: 0,
    atLimit: 0,
    inactive: 0,
  };
  for (const c of customers) {
    if (c.balance > 0) {
      summary.totalDebt += c.balance;
      summary.debtors++;
    }
    if (isOverdue(c, now)) summary.overdue++;
    if (c.balance > 0 && getCreditLevel(c) === "full") summary.atLimit++;
    if (!c.isActive) summary.inactive++;
  }
  return summary;
}

export function filterCustomers(
  customers: Customer[],
  { query, filter }: Pick<CustomerFilters, "query" | "filter">,
  now = Date.now(),
) {
  const text = normalizeDigits(query).trim().toLowerCase();
  const digits = cleanPhone(query);

  return customers.filter((c) => {
    if (text) {
      const byName = c.name.toLowerCase().includes(text);
      const byPhone = digits.length > 0 && c.phone.includes(digits);
      if (!byName && !byPhone) return false;
    }
    switch (filter) {
      case "debtors":
        return c.balance > 0;
      case "overdue":
        return isOverdue(c, now);
      case "limit":
        return c.balance > 0 && getCreditLevel(c) === "full";
      case "inactive":
        return !c.isActive;
      default:
        return true;
    }
  });
}

const COMPARE: Record<CustomerSortKey, (a: Customer, b: Customer) => number> = {
  debt: (a, b) => b.balance - a.balance,
  name: (a, b) => a.name.localeCompare(b.name, "ar"),
  recent: (a, b) => (b.lastPurchaseAt ?? 0) - (a.lastPurchaseAt ?? 0),
  sales: (a, b) => b.totalSales - a.totalSales,
  newest: (a, b) => b.createdAt - a.createdAt,
};

export const sortCustomers = (customers: Customer[], sort: CustomerSortKey) =>
  [...customers].sort(COMPARE[sort]);
