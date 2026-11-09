import type { UserRole } from "./user";

export interface UserDto {
  id: string;
  username: string;
  role: UserRole;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface UserCreatePayload {
  username: string;
  password: string;
  role: UserRole;
}

export interface UserUpdatePayload {
  username?: string;
  role?: UserRole;
  is_active?: boolean;
}

export interface ResetPasswordPayload {
  new_password: string;
}