import { z } from "zod";

import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  SHOP_NAME_MAX,
  SHOP_NAME_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
} from "../config/setupOptions";

const check = (fn: (text: string) => string | null) =>
  z.string().superRefine((text, ctx) => {
    const message = fn(text);
    if (message) ctx.addIssue({ code: "custom", message });
  });

const length = (text: string) => [...text].length;

export const cleanShopName = (text: string) => text.split(/\s+/).filter(Boolean).join(" ");
export const cleanUsername = (text: string) => text.normalize("NFKC").trim().toLowerCase();

const USERNAME_RE = new RegExp(`^[a-z0-9._-]{${USERNAME_MIN},${USERNAME_MAX}}$`);

function shopNameError(text: string) {
  const n = length(cleanShopName(text));
  if (n === 0) return "اكتب اسم المحل";
  if (n < SHOP_NAME_MIN) return `اسم المحل ${SHOP_NAME_MIN} أحرف على الأقل`;
  if (n > SHOP_NAME_MAX) return `اسم المحل أطول من ${SHOP_NAME_MAX} حرفاً`;
  return null;
}

function usernameError(text: string) {
  const u = cleanUsername(text);
  if (!u) return "اكتب اسم المستخدم";
  if (!USERNAME_RE.test(u))
    return `من ${USERNAME_MIN} إلى ${USERNAME_MAX} خانة: حروف إنجليزية أو أرقام أو . _ -`;
  return null;
}

function passwordError(text: string) {
  const p = text.normalize("NFKC");
  if (!p) return "اكتب كلمة المرور";
  if (length(p) < PASSWORD_MIN) return `كلمة المرور ${PASSWORD_MIN} خانات على الأقل`;
  if (length(p) > PASSWORD_MAX) return `كلمة المرور أطول من ${PASSWORD_MAX} خانة`;
  if (!p.trim()) return "كلمة المرور لا يمكن أن تكون مسافات فقط";
  if (new Set(p).size < 4) return "كلمة المرور ضعيفة: حروفها متكررة";
  return null;
}

export const setupSchema = z
  .object({
    shopName: check(shopNameError),
    username: check(usernameError),
    password: check(passwordError),
    confirm: z.string(),
  })
  .superRefine((v, ctx) => {
    const u = cleanUsername(v.username);
    if (u && v.password.normalize("NFKC").toLowerCase().includes(u))
      ctx.addIssue({ code: "custom", path: ["password"], message: "كلمة المرور لا يجب أن تحتوي اسم المستخدم" });
    if (v.confirm !== v.password)
      ctx.addIssue({ code: "custom", path: ["confirm"], message: "كلمتا المرور غير متطابقتين" });
  });

export type SetupSchemaType = z.infer<typeof setupSchema>;