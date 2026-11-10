import { useQuery } from "@tanstack/react-query";

import { getUsers } from "../api/users.api";
import { userKeys } from "../config/userQueryKeys";

export default function useGetUsers() {
  return useQuery({ queryKey: userKeys.list, queryFn: getUsers });
}
