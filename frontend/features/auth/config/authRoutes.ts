import type { UserRole } from "./authOptions";

export const AUTH_ROUTES = {
  login: "/auth",
  home: {
    owner: "/admin/dashboard",
    manager: "/admin/dashboard",
    cashier: "/pos",
  } satisfies Record<UserRole, string>,
} as const;
