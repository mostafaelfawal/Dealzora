"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { UseQueryResult } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { createContext, type ReactNode, useContext, useEffect } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";

import { USER_ROUTES } from "../config/userRoutes";
import useCreateUser from "../hooks/useCreateUser";
import useGetUser from "../hooks/useGetUser";
import useUpdateUser from "../hooks/useUpdateUser";
import { emptyValues, toFormValues } from "../lib/userForm";
import {
  userCreateSchema,
  userEditSchema,
  type UserSchemaType,
} from "../schema/user.schema";
import type { User } from "../types/user";

export type UserSubmitHandler = (
  values: UserSchemaType,
  andNew: boolean,
) => void | Promise<void>;

type UserFormContextType = {
  form: UseFormReturn<UserSchemaType>;
  userId: string | null;
  userData: UseQueryResult<User | undefined, Error>;
  onSubmit: UserSubmitHandler;
  /** true طول ما طلب الإضافة أو التعديل شغال (من الـ mutation فقط). */
  isSaving: boolean;
};

export const UserFormContext = createContext<UserFormContextType | null>(null);

export default function UserFormContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("user_id");
  const userData = useGetUser(userId);
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();

  const form = useForm<UserSchemaType>({
    // الإضافة تتحقق من كلمة المرور، والتعديل لا (تتغير من نافذتها).
    resolver: zodResolver(userId ? userEditSchema : userCreateSchema),
    defaultValues: emptyValues(),
    shouldFocusError: false,
  });

  const { reset } = form;
  const loaded = userData.data;

  useEffect(() => {
    if (!userId) {
      reset(emptyValues());
      return;
    }
    if (loaded) reset(toFormValues(loaded));
  }, [userId, loaded, reset]);

  // الأخطاء يعرضها toast داخل الـ hooks، فنبلعها هنا حتى لا تصير unhandled.
  const onSubmit: UserSubmitHandler = async (values, andNew) => {
    try {
      if (userId) {
        if (!loaded) return;
        await updateMutation.mutateAsync({ id: userId, values });
        router.push(USER_ROUTES.list);
        return;
      }

      await createMutation.mutateAsync(values);
      if (andNew) {
        reset(emptyValues());
        document.getElementById("uf-username")?.focus();
      } else {
        router.push(USER_ROUTES.list);
      }
    } catch {
      // تم عرض الخطأ في onError.
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <UserFormContext.Provider
      value={{ form, userData, userId, onSubmit, isSaving }}
    >
      {children}
    </UserFormContext.Provider>
  );
}

export function useUserFormContext() {
  const context = useContext(UserFormContext);

  if (!context) {
    throw new Error(
      "useUserFormContext يجب ان تكون بداخل UserFormContextProvider",
    );
  }
  return context;
}