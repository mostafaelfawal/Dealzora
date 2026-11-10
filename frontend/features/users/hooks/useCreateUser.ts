import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { extractErrorMessage } from "@/lib/errors";

import { createUser } from "../api/users.api";
import { userKeys } from "../config/userQueryKeys";
import { toCreatePayload } from "../lib/userPayload";
import type { UserSchemaType } from "../schema/user.schema";

export default function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: UserSchemaType) => createUser(toCreatePayload(values)),
    onSuccess: (user) => {
      toast.success(`تمت إضافة «${user.username}»`);
      return queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });
}
