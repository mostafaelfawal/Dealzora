export type UserRole = "owner" | "manager" | "cashier";

export interface SessionUser {
  name: string;
  role: UserRole;
}
