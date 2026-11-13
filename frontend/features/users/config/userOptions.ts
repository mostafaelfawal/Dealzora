import type {
  RoleFilter,
  StatusFilter,
  UserRole,
  UserSortKey,
} from "../types/user";

export const PAGE_SIZES = [12, 24, 48, 96];

export const ROLE_LABEL: Record<UserRole, string> = {
  owner: "مالك",
  manager: "مدير",
  cashier: "كاشير",
};

export const ROLE_TONE: Record<UserRole, string> = {
  owner: "border-warning/60 bg-warning/10 text-warning",
  manager: "border-primary/50 text-primary",
  cashier: "text-muted-foreground",
};

export const ROLE_HELP: Record<UserRole, string> = {
  cashier: "حساب تشغيل يومي، بدون صلاحيات إدارة النظام.",
  manager:
    "مدير الفرع: كل الأعمال اليومية وإدارة الكاشيرية. مدير واحد فقط لكل فرع.",
  owner: "مالك المحل: كل الصلاحيات في كل الفروع، وحسابه واحد في كل الفروع.",
};

/** الأدوار اللي يقدر الحساب الحالي يسندها: المالك يعمل مدير وكاشير، والمدير يعمل كاشير بس. */
export const assignableRoles = (
  actor: UserRole | null | undefined,
): UserRole[] => (actor === "owner" ? ["cashier", "manager"] : ["cashier"]);

/** هل الحساب الحالي يقدر يدير المستخدم ده؟ (المدير يدير الكاشيرية بس) */
export const canManageUser = (
  actor: UserRole | null | undefined,
  target: UserRole,
) => actor === "owner" || (actor === "manager" && target === "cashier");

export const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "كل الأدوار" },
  { value: "cashier", label: "الكاشير" },
  { value: "manager", label: "المديرون" },
  { value: "owner", label: "المالك" },
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
