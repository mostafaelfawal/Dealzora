"use client";

import { useSyncExternalStore } from "react";

import { readSession } from "@/features/auth/lib/authStorage";
import { useBackupStatus, useLicense } from "@/features/settings/hooks/useSettings";
import { useCurrentShift } from "@/features/shifts/hooks/useShifts";
import { useNow } from "@/hooks/useNow";
import type { SessionUser } from "@/types/auth";
import type { SyncState, Subscription } from "@/types/shell";

/** آخر نسخة أقدم من هذا = تنبيه في شريط الحالة. */
const STALE_BACKUP_HOURS = 48;

const GUEST: SessionUser = { name: "", role: "cashier" };

// الجلسة ثابتة طول عمر الصفحة (تتغير بتسجيل الدخول/الخروج فقط، وكلاهما يغيّر الصفحة).
let cachedKey = "";
let cachedUser: SessionUser = GUEST;
function readUser(): SessionUser {
  const session = readSession();
  const key = session ? `${session.user.id}:${session.user.role}` : "";
  if (key !== cachedKey) {
    cachedKey = key;
    cachedUser = session
      ? { name: session.user.username, role: session.user.role }
      : GUEST;
  }
  return cachedUser;
}

const noop = () => () => {};

export function useSessionUser(): SessionUser {
  return useSyncExternalStore(noop, readUser, () => GUEST);
}

/** مصدر بيانات الـ Header والـ Sidebar: المستخدم + الوردية + النسخ الاحتياطي + الترخيص. */
export function useShellData() {
  const user = useSessionUser();
  const shiftQuery = useCurrentShift();
  const backup = useBackupStatus();
  const license = useLicense();

  const shift = shiftQuery.data ?? null;
  const now = useNow(60_000);
  const last = backup.data?.lastBackupAt ?? 0;
  const stale = !last || (now !== null && now - last > STALE_BACKUP_HOURS * 3_600_000);

  const sync: SyncState = {
    status: backup.isError ? "offline" : stale && backup.data ? "error" : "synced",
    lastSyncedAt: last,
  };

  const daysLeft = license.data?.days_left;
  const subscription: Subscription = {
    daysRemaining: typeof daysLeft === "number" ? daysLeft : Number.POSITIVE_INFINITY,
  };

  return {
    user,
    shift,
    /** للمدير فقط (الكاشير يستلم null من الـ backend). */
    drawerBalance: shift?.expectedCash ?? 0,
    sync,
    subscription,
    isShiftLoading: shiftQuery.isPending,
  };
}
