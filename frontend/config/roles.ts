import type { UserRole } from "@/types/auth";

export const ROLE_LABELS: Record<UserRole, string> = {
  manager: "مدير",
  cashier: "كاشير",
};

interface RolePermissions {
  /** الكاشير بيعدّ الدرج "أعمى" في آخر الوردية، فمبيشوفش الرصيد المتوقع. */
  canViewDrawerBalance: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  manager: { canViewDrawerBalance: true },
  cashier: { canViewDrawerBalance: false },
};
