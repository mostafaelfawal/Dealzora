import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .email("ادخل بريد إلكتروني صالح")
    .max(30, "البريد الإلكتروني طويل"),
  password: z
    .string()
    .min(6, "ادخل على الأقل 6 أحرف")
    .max(30, "كلمة السر طويلة"),
  remember: z.boolean().default(false).optional(),
});

export type LoginSchema = z.infer<typeof loginSchema>;
