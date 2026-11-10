"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useSyncExternalStore } from "react";

import { AUTH_EXPIRED_EVENT } from "@/lib/axios";

import type { UserRole } from "../config/authOptions";
import { AUTH_ROUTES } from "../config/authRoutes";
import { clearSession, readSession } from "../lib/authStorage";

// الجلسة تتغير فقط عبر AUTH_EXPIRED_EVENT (من axios عند 401)
const subscribe = (onChange: () => void) => {
  window.addEventListener(AUTH_EXPIRED_EVENT, onChange);
  return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onChange);
};

// نرجع الدور كنص (قيمة بدائية) ليكون الـ snapshot ثابتاً بين الاستدعاءات
const getSnapshot = (): UserRole | null => readSession()?.user.role ?? null;
const getServerSnapshot = (): UserRole | null => null;

export function AuthGuard({
  children,
  role,
}: {
  children: ReactNode;
  /** دور واحد أو أكثر مسموح لهم (الكاشير والمدير كلاهما يبيعان). */
  role?: UserRole | UserRole[];
}) {
  const router = useRouter();
  const sessionRole = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const roles = role === undefined ? null : Array.isArray(role) ? role : [role];
  const roleOk = sessionRole !== null && (!roles || roles.includes(sessionRole));
  const allowed = sessionRole !== null && roleOk;

  useEffect(() => {
    if (sessionRole === null) {
      clearSession(); // يمسح الـ cookie أيضاً
      router.replace(AUTH_ROUTES.login);
    } else if (!roleOk) {
      router.replace(AUTH_ROUTES.home[sessionRole]);
    }
  }, [sessionRole, roleOk, router]);

  return allowed ? <>{children}</> : null;
}
