import { useQuery } from "@tanstack/react-query";

import { fetchStatement } from "../api/customers.api";
import { customerKeys } from "../config/customerQueryKeys";

export default function useGetStatement(id: string | null) {
  return useQuery({
    queryKey: customerKeys.statement(id ?? ""),
    queryFn: () => fetchStatement(id as string),
    enabled: id !== null,
    staleTime: 0,
  });
}
