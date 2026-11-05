import { api } from "@/lib/axios";
import type { UserDto } from "@/features/auth/types/authApi";

import type { SetupPayload } from "../types/setup";

export const fetchSetupRequired = async (): Promise<boolean> =>
  (await api.get<{ setup_required: boolean }>("/users/setup-status")).data.setup_required;

export const setupFirstManager = async (p: SetupPayload): Promise<UserDto> =>
  (
    await api.post<UserDto>("/users/setup", {
      shop_name: p.shopName,
      username: p.username,
      password: p.password,
    })
  ).data;