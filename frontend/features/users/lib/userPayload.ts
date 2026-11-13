import { cleanUsername } from "../schema/user.schema";
import type { UserSchemaType } from "../schema/user.schema";
import type { UserCreatePayload, UserUpdatePayload } from "../types/userApi";

export const toCreatePayload = (v: UserSchemaType): UserCreatePayload => ({
  username: cleanUsername(v.username),
  password: v.password,
  role: v.role === "owner" ? "cashier" : v.role, // المالك لا يُنشأ من هنا أبداً
});

export const toUpdatePayload = (v: UserSchemaType): UserUpdatePayload => ({
  username: cleanUsername(v.username),
  // دور المالك لا يُسند ولا يُغيَّر من الواجهة (الـ backend يرفضه)
  ...(v.role === "owner" ? {} : { role: v.role }),
  is_active: v.isActive,
});
