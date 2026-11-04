import type { UserRole } from "./authOptions";

export const AUTH_ROUTES = {
  login: "/auth",
  home: {
    manager: "/admin/dashboard",
    cashier: "/pos",
  } satisfies Record<UserRole, string>,
} as const;
