export const USER_ROLES = ["cashier", "manager", "owner"] as const;
export type UserRole = (typeof USER_ROLES)[number];
/** تبويب شاشة الدخول (نص فقط؛ الدور الحقيقي من الـ backend). المالك يدخل من «إدارة». */
export type LoginRole = "cashier" | "manager";

export interface LoginRoleCopy {
  value: LoginRole;
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
    label: "مدير / مالك",
    title: "دخول الإدارة",
    description: "سجّل دخولك كمدير الفرع أو مالك المحل.",
    submitLabel: "تسجيل الدخول",
  },
];

export const LOGIN_ROLE_COPY = Object.fromEntries(
  LOGIN_ROLE_OPTIONS.map((option) => [option.value, option]),
) as Record<LoginRole, LoginRoleCopy>;
