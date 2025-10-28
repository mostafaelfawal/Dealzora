import { z } from "zod";

export const addProductSchema = z.object({
  name: z
    .string()
    .min(1, "اسم المنتج مطلوب")
    .max(43, "اسم المنتج أطول من اللازم"),

  price: z.coerce
    .number()
    .min(1, "السعر لا يمكن أن يكون 0")
    .max(10000000000, "السعر أكبر من اللازم"),

  categories: z
    .string()
    .min(1, "اسم الفئة مطلوب")
    .max(30, "اسم الفئة أطول من اللازم"),

  stock: z.coerce
    .number()
    .min(0, "المخزون لا يمكن أن يكون سالبًا")
    .max(10000000000, "المخزون أكبر من اللازم")
    .optional(),

  code: z.string().min(1, "الكود مطلوب").max(50, "الكود أطول من اللازم"),

  stockAlert: z.coerce
    .number()
    .min(0, "حد التنبيه لا يمكن أن يكون سالبًا")
    .max(10000000000, "حد التنبيه أكبر من اللازم")
    .optional(),
  image: z.string().optional(),
});

export type productSchemaType = z.infer<typeof addProductSchema>;
