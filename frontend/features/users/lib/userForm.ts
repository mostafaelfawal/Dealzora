import type { UserSchemaType } from "../schema/user.schema";
import type { User } from "../types/user";

export const emptyValues = (): UserSchemaType => ({
  username: "",
  password: "",
  role: "cashier", // أقل صلاحية افتراضياً
  isActive: true,
});

export function toFormValues(user?: User): UserSchemaType {
  if (!user) return emptyValues();
  return {
    username: user.username,
    password: "",
    role: user.role,
    isActive: user.isActive,
  };
}
