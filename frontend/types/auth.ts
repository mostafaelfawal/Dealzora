export type UserRole = "manager" | "cashier";

export interface SessionUser {
  name: string;
  role: UserRole;
}
