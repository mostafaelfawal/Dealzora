import { z } from "zod";

import { MAX_PASSWORD_LEN, MAX_USERNAME_LEN } from "../config/authLimits";

const check = (fn: (text: string) => string | null) =>
  z.string().superRefine((text, ctx) => {
    const message = fn(text);
    if (message) ctx.addIssue({ code: "custom", message });
  });

const length = (text: string) => [...text].length;

function usernameError(text: string) {
  if (text.normalize("NFKC").trim() === "") return "اكتب اسم المستخدم";
  if (length(text) > MAX_USERNAME_LEN)
    return `اسم المستخدم أطول من ${MAX_USERNAME_LEN} خانة`;
  return null;
}

function passwordError(text: string) {
  if (text.length === 0) return "اكتب كلمة المرور";
  if (length(text) > MAX_PASSWORD_LEN)
    return `كلمة المرور أطول من ${MAX_PASSWORD_LEN} خانة`;
  return null;
}

export const loginSchema = z.object({
  role: z.enum(["cashier", "manager"]), // تبويب الدخول فقط (المالك من «إدارة»)
  username: check(usernameError),
  password: check(passwordError),
});

export type LoginSchemaType = z.infer<typeof loginSchema>;
