/** المالك ← المدير (واحد لكل فرع) ← الكاشيرية. */
export type UserRole = "owner" | "manager" | "cashier";

export interface User {
  id: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export type RoleFilter = "all" | UserRole;
export type StatusFilter = "all" | "active" | "inactive";
export type UserSortKey = "name_asc" | "newest" | "last_login";
export type UsersView = "cards" | "table";

export interface UserFilters {
  query: string;
  role: RoleFilter;
  status: StatusFilter;
  sort: UserSortKey;
  page: number;
  pageSize: number;
}

export interface UsersSummary {
  total: number;
  cashiers: number;
  managers: number;
  owners: number;
  inactive: number;
}
