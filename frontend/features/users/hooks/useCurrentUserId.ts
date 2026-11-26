"use client";

import { useSyncExternalStore } from "react";

import { readSession } from "@/features/auth/lib/authStorage";

const noop = () => () => {};
const readId = () => readSession()?.user.id ?? null;

/**
 * معرّف المستخدم المسجّل حالياً، لتعطيل الإجراءات الممنوعة على الحساب نفسه
 * (تعطيل/حذف/تغيير الدور/إعادة تعيين كلمة المرور). كلمة مرورك تتغير من «الإعدادات ← حسابي».
 */
export default function useCurrentUserId(): string | null {
  return useSyncExternalStore(noop, readId, () => null);
}
