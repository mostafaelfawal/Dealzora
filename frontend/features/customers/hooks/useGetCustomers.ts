import { useQuery } from "@tanstack/react-query";

import { fetchCustomers } from "../api/customers.api";
import { customerKeys } from "../config/customerQueryKeys";

export default function useGetCustomers() {
  return useQuery({
    queryKey: customerKeys.list(),
    queryFn: fetchCustomers,
  });
}
