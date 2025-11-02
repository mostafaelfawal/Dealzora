import z from "zod";

export const supplierSchema = z.object({
  name: z.string().min(1, "اسم المورد مطلوب").max(43, "الأسم أطول من اللازم"),
  phoneNumber: z
    .string()
    .min(1, "رقم المورد مطلوب")
    .max(20, "رقم الهاتف اطول من الازم"),
  altPhoneNumber: z.string().max(20, "رقم الهاتف اطول من الازم").optional(),
  companyName: z.string().max(43, "اسم الشركة أطول من اللازم").optional(),
  email: z
    .string()
    .email("البريد الألكتوني غير صحيح")
    .max(100, "البريد الألكتروني طويل جدا")
    .optional()
    .or(z.literal("")),
  address: z.string().max(60, "العنوان اطول من الازم").optional(),
  city: z.string().max(25, "اسم المدينه اطول من الازم").optional(),
  notes: z.string().max(300, "الملاحظات اطول من الازم").optional(),
  isActive: z.boolean().default(true),
});

export type supplierSchemaType = z.infer<typeof supplierSchema>;
