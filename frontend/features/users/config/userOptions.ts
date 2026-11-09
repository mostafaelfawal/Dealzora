import type {
  RoleFilter,
  StatusFilter,
  UserRole,
  UserSortKey,
} from "../types/user";

export const PAGE_SIZES = [12, 24, 48, 96];

export const ROLE_LABEL: Record<UserRole, string> = {
  manager: "مدير",
  cashier: "كاشير",
};

export const ROLE_TONE: Record<UserRole, string> = {
  manager: "border-primary/50 text-primary",
  cashier: "text-muted-foreground",
};

export const ROLE_HELP: Record<UserRole, string> = {
  cashier: "حساب تشغيل يومي، بدون صلاحيات إدارة النظام.",
  manager: "صلاحيات كاملة، منها إدارة المستخدمين.",
};

/** الأدوار التي يقبل الـ backend إسنادها. */
export const ASSIGNABLE_ROLES: UserRole[] = ["cashier", "manager"];

export const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "كل الأدوار" },
  { value: "cashier", label: "الكاشير" },
  { value: "manager", label: "المديرون" },
];

export const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "كل الحالات" },
  { value: "active", label: "نشطون" },
  { value: "inactive", label: "معطّلون" },
];

export const SORT_OPTIONS: { value: UserSortKey; label: string }[] = [
  { value: "name_asc", label: "الاسم (أ - ي)" },
  { value: "newest", label: "الأحدث إضافة" },
  { value: "last_login", label: "آخر دخول" },
];

export const USERS_SEARCH_ID = "users-search";