import { z } from "zod";

import { normalizeDigits } from "@/lib/format";

import {
  COMMON_PASSWORDS,
  MAX_PASSWORD_LEN,
  MIN_PASSWORD_LEN,
  USERNAME_PATTERN,
} from "../config/userLimits";

const length = (text: string) => [...text].length;

/** نفس تطبيع الـ backend (NFKC + lowercase)، مع قبول الأرقام العربية. */
export const cleanUsername = (text: string) =>
  normalizeDigits(text.normalize("NFKC")).trim().toLowerCase();

const check = (fn: (text: string) => string | null) =>
  z.string().superRefine((text, ctx) => {
    const message = fn(text);
    if (message) ctx.addIssue({ code: "custom", message });
  });

function usernameError(text: string) {
  const value = cleanUsername(text);
  if (!value) return "اسم المستخدم مطلوب";
  if (!USERNAME_PATTERN.test(value))
    return "اسم المستخدم من 3 إلى 50 خانة: حروف إنجليزية صغيرة أو أرقام أو . _ -";
  return null;
}

/** تحقق كلمة المرور (مطابق لقواعد الـ backend). username اختياري للفحص المتقاطع. */
export function passwordError(text: string, username = ""): string | null {
  const value = text.normalize("NFKC");
  if (length(value) < MIN_PASSWORD_LEN)
    return `كلمة المرور يجب ألا تقل عن ${MIN_PASSWORD_LEN} خانات`;
  if (length(value) > MAX_PASSWORD_LEN)
    return `كلمة المرور أطول من ${MAX_PASSWORD_LEN} خانة`;
  if (!value.trim()) return "كلمة المرور لا يمكن أن تكون مسافات فقط";
  if (new Set(value).size < 4) return "كلمة المرور ضعيفة: حروفها متكررة";
  if (COMMON_PASSWORDS.has(value.toLowerCase()))
    return "كلمة المرور شائعة وسهلة التخمين";
  const name = cleanUsername(username);
  if (name && value.trim().toLowerCase().includes(name))
    return "كلمة المرور لا يجب أن تحتوي اسم المستخدم";
  return null;
}

const base = {
  username: check(usernameError),
  role: z.enum(["owner", "manager", "cashier"]),
  isActive: z.boolean(),
};

/** إضافة: كلمة المرور مطلوبة. */
export const userCreateSchema = z
  .object({ ...base, password: z.string() })
  .superRefine((values, ctx) => {
    const message = passwordError(values.password, values.username);
    if (message) ctx.addIssue({ code: "custom", message, path: ["password"] });
  });

/** تعديل: كلمة المرور لا تتغير من هنا (نافذة تغيير كلمة المرور). */
export const userEditSchema = z.object({ ...base, password: z.string() });

export type UserSchemaType = z.infer<typeof userCreateSchema>;
