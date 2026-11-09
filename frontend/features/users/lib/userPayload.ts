import { cleanUsername } from "../schema/user.schema";
import type { UserSchemaType } from "../schema/user.schema";
import type { UserCreatePayload, UserUpdatePayload } from "../types/userApi";

export const toCreatePayload = (v: UserSchemaType): UserCreatePayload => ({
  username: cleanUsername(v.username),
  password: v.password,
  role: v.role,
});

export const toUpdatePayload = (v: UserSchemaType): UserUpdatePayload => ({
  username: cleanUsername(v.username),
  role: v.role,
  is_active: v.isActive,
});