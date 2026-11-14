import { z } from "zod";

import { passwordError } from "@/features/users/schema/user.schema";

import {
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

export const cleanShopName = (text: string) =>
  text.split(/\s+/).filter(Boolean).join(" ");
export const cleanUsername = (text: string) =>
  text.normalize("NFKC").trim().toLowerCase();

const USERNAME_RE = new RegExp(
  `^[a-z0-9._-]{${USERNAME_MIN},${USERNAME_MAX}}$`,
);

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

export const setupSchema = z
  .object({
    shopName: check(shopNameError),
    username: check(usernameError),
    password: z.string(),
    confirm: z.string(),
  })
  .superRefine((v, ctx) => {
    // نفس قواعد الـ backend (مصدر واحد مع شاشة المستخدمين)
    const message = v.password
      ? passwordError(v.password, v.username)
      : "اكتب كلمة المرور";
    if (message) ctx.addIssue({ code: "custom", path: ["password"], message });
    if (v.confirm !== v.password)
      ctx.addIssue({
        code: "custom",
        path: ["confirm"],
        message: "كلمتا المرور غير متطابقتين",
      });
  });

export type SetupSchemaType = z.infer<typeof setupSchema>;
