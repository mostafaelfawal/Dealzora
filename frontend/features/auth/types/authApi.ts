export interface UserDto {
  id: string;
  username: string;
  role: "cashier" | "manager" | "owner";
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface LoginDto {
  token: string;
  expires_at: string;
  user: UserDto;
}
