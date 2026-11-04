import type { AuthSession, AuthUser } from "../types/auth";
import type { LoginDto, UserDto } from "../types/authApi";

export const toAuthUser = (dto: UserDto): AuthUser => ({
  id: dto.id,
  username: dto.username,
  role: dto.role,
  isActive: dto.is_active,
  lastLoginAt: dto.last_login_at,
});

export const toSession = (dto: LoginDto): AuthSession => ({
  token: dto.token,
  expiresAt: dto.expires_at,
  user: toAuthUser(dto.user),
});
