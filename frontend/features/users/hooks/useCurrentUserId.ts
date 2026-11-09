/**
 * معرّف المستخدم المسجّل حالياً، لتعطيل الإجراءات الممنوعة على الحساب نفسه
 * (تعطيل/حذف/تغيير الدور/تغيير كلمة المرور من المدير).
 *
 * TODO: اربطه بالـ hook الموجود عندك في feature الـ auth، مثال:
 *   import { useAuth } from "@/features/auth/hooks/useAuth";
 *   export default function useCurrentUserId() { return useAuth().user?.id ?? null; }
 *
 * لو رجّع null: الواجهة لا تعطّل شيئاً، والـ backend يرفض العملية برسالة واضحة.
 */
export default function useCurrentUserId(): string | null {
  return null;
}