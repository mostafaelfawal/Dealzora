import { z } from "zod";

export const signinSchema = z
  .object({
    firstName: z.string().min(2, "الاسم قصير جدًا").max(20, "الاسم طويل جدًا"),
    lastName: z.string().min(2, "الاسم قصير جدًا").max(20, "الاسم طويل جدًا"),
    email: z
      .string()
      .email("ادخل بريد إلكتروني صالح")
      .max(30, "البريد الإلكتروني طويل"),
    password: z
      .string()
      .min(6, "ادخل على الأقل 6 أحرف")
      .max(30, "كلمة السر طويلة"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "كلمة السر غير متطابقة",
    path: ["confirmPassword"],
  });

export type SigninSchema = z.infer<typeof signinSchema>;
