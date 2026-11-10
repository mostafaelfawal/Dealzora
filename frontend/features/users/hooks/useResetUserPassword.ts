import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { extractErrorMessage } from "@/lib/errors";

import { resetUserPassword } from "../api/users.api";

interface ResetVars {
  userId: string;
  username: string;
  password: string;
}

export default function useResetUserPassword() {
  return useMutation({
    mutationFn: ({ userId, password }: ResetVars) =>
      resetUserPassword(userId, { new_password: password }),
    onSuccess: (_data, vars) =>
      toast.success(`تم تغيير كلمة مرور «${vars.username}»`),
    onError: (error) =>
      toast.error(extractErrorMessage(error, "تعذّر تغيير كلمة المرور")),
  });
}
