import type { User } from "../types/user";
import type { UserDto } from "../types/userApi";

export const toUser = (dto: UserDto): User => ({
  id: dto.id,
  username: dto.username,
  role: dto.role,
  isActive: dto.is_active,
  lastLoginAt: dto.last_login_at,
  createdAt: dto.created_at,
});
