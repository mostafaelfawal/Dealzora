import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { extractErrorMessage } from "@/lib/errors";

import { updateUser } from "../api/users.api";
import { userKeys } from "../config/userQueryKeys";
import { toUpdatePayload } from "../lib/userPayload";
import type { UserSchemaType } from "../schema/user.schema";

interface UpdateVars {
  id: string;
  values: UserSchemaType;
}

export default function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: UpdateVars) =>
      updateUser(id, toUpdatePayload(values)),
    onSuccess: (user) => {
      toast.success(`تم حفظ تعديلات «${user.username}»`);
      return queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });
}