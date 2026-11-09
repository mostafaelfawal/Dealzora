import { useQuery } from "@tanstack/react-query";

import { getUsers } from "../api/users.api";
import { userKeys } from "../config/userQueryKeys";

/** لا يوجد GET /users/{id}: نقرأ من نفس قائمة المستخدمين ونختار منها. */
export default function useGetUser(id?: string | null) {
  return useQuery({
    queryKey: userKeys.list,
    queryFn: getUsers,
    enabled: !!id,
    select: (users) => users.find((u) => u.id === id),
  });
}