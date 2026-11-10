import { normalizeDigits } from "@/lib/format";

import type {
  User,
  UserFilters,
  UserSortKey,
  UsersSummary,
} from "../types/user";

export const DEFAULT_FILTERS: UserFilters = {
  query: "",
  role: "all",
  status: "all",
  sort: "name_asc",
  page: 1,
  pageSize: 24,
};

export const EMPTY_SUMMARY: UsersSummary = {
  total: 0,
  cashiers: 0,
  managers: 0,
  inactive: 0,
};

export const isFiltered = (f: UserFilters) =>
  f.query.trim() !== "" || f.role !== "all" || f.status !== "all";

export const summarize = (users: User[]): UsersSummary => ({
  total: users.length,
  cashiers: users.filter((u) => u.role === "cashier").length,
  managers: users.filter((u) => u.role === "manager").length,
  inactive: users.filter((u) => !u.isActive).length,
});

const COMPARATORS: Record<UserSortKey, (a: User, b: User) => number> = {
  name_asc: (a, b) => a.username.localeCompare(b.username),
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  last_login: (a, b) =>
    (b.lastLoginAt ?? "").localeCompare(a.lastLoginAt ?? ""),
};

/** الفلترة والترتيب في الـ frontend (الـ backend يرجّع القائمة كاملة). */
export function applyFilters(users: User[], f: UserFilters): User[] {
  const q = normalizeDigits(f.query).trim().toLowerCase();
  return users
    .filter(
      (u) =>
        (!q || u.username.includes(q)) &&
        (f.role === "all" || u.role === f.role) &&
        (f.status === "all" || (f.status === "active") === u.isActive),
    )
    .sort(COMPARATORS[f.sort]);
}
