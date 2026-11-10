import { api } from "@/lib/axios";

import { toUser } from "../lib/userMapper";
import type { User } from "../types/user";
import type {
  ResetPasswordPayload,
  UserCreatePayload,
  UserDto,
  UserUpdatePayload,
} from "../types/userApi";

// GET /users  (قائمة كاملة بدون pagination، والفلترة تتم في الـ frontend)
export const getUsers = async (): Promise<User[]> =>
  (await api.get<UserDto[]>("/users")).data.map(toUser);

// POST /users
export const createUser = async (payload: UserCreatePayload): Promise<User> =>
  toUser((await api.post<UserDto>("/users", payload)).data);

// PATCH /users/{id}
export const updateUser = async (
  id: string,
  payload: UserUpdatePayload,
): Promise<User> =>
  toUser((await api.patch<UserDto>(`/users/${id}`, payload)).data);

// POST /users/{id}/reset-password
export const resetUserPassword = async (
  id: string,
  payload: ResetPasswordPayload,
): Promise<void> => {
  await api.post(`/users/${id}/reset-password`, payload);
};

// DELETE /users/{id}
export const deleteUser = async (id: string): Promise<void> => {
  await api.delete(`/users/${id}`);
};
