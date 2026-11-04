export const USER_ROLES = ["cashier", "manager"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface LoginRoleCopy {
  value: UserRole;
  label: string;
  title: string;
  description: string;
  submitLabel: string;
}

export const LOGIN_ROLE_OPTIONS: LoginRoleCopy[] = [
  {
    value: "cashier",
    label: "كاشير",
    title: "بدء الوردية",
    description: "اكتب بياناتك لتبدأ البيع.",
    submitLabel: "بدء وردية جديدة",
  },
  {
    value: "manager",
    label: "مدير",
    title: "دخول المدير",
    description: "سجّل دخولك لإدارة المحل.",
    submitLabel: "تسجيل الدخول",
  },
];

export const LOGIN_ROLE_COPY = Object.fromEntries(
  LOGIN_ROLE_OPTIONS.map((option) => [option.value, option]),
) as Record<UserRole, LoginRoleCopy>;
