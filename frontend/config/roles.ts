import type { UserRole } from "@/types/auth";

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "مالك",
  manager: "مدير",
  cashier: "كاشير",
};

/** الإدارة = المالك أو المدير (كل ما كان «للمدير» مسموح للمالك). */
export const isManagement = (role: UserRole | null | undefined) =>
  role === "owner" || role === "manager";

export const isOwner = (role: UserRole | null | undefined) => role === "owner";

interface RolePermissions {
  /** الكاشير بيعدّ الدرج "أعمى" في آخر الوردية، فمبيشوفش الرصيد المتوقع. */
  canViewDrawerBalance: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  owner: { canViewDrawerBalance: true },
  manager: { canViewDrawerBalance: true },
  cashier: { canViewDrawerBalance: false },
};
