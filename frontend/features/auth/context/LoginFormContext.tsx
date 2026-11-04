"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, type ReactNode, useContext, useEffect } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";

import { AUTH_ROUTES } from "../config/authRoutes";
import useLogin from "../hooks/useLogin";
import { readLastLogin, saveLastLogin, saveSession } from "../lib/authStorage";
import { emptyLoginValues } from "../lib/loginForm";
import { loginSchema, type LoginSchemaType } from "../schema/login.schema";

export const LOGIN_FIELD_IDS = {
  username: "login-username",
  password: "login-password",
} as const;

type LoginFormContextType = {
  form: UseFormReturn<LoginSchemaType>;
  submit: (event?: React.BaseSyntheticEvent) => Promise<void>;
  isLoggingIn: boolean;
  loginError: Error | null;
  clearError: () => void;
};

export const LoginFormContext = createContext<LoginFormContextType | null>(
  null,
);

export default function LoginFormContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const loginMutation = useLogin();

  const form = useForm<LoginSchemaType>({
    resolver: zodResolver(loginSchema),
    defaultValues: emptyLoginValues(),
  });

  const { reset, resetField, handleSubmit } = form;

  useEffect(() => {
    const last = readLastLogin();
    if (!last) return;
    reset({ role: last.role, username: last.username, password: "" });
    document.getElementById(LOGIN_FIELD_IDS.password)?.focus();
  }, [reset]);

  const submit = handleSubmit((values) => {
    loginMutation.mutate(
      { username: values.username.trim(), password: values.password },
      {
        onSuccess: (session) => {
          saveSession(session);
          saveLastLogin({
            role: session.user.role,
            username: session.user.username,
          });
          queryClient.clear();
          router.replace(AUTH_ROUTES.home[session.user.role]);
        },
        onError: () => {
          resetField("password", { defaultValue: "" });
          document.getElementById(LOGIN_FIELD_IDS.password)?.focus();
        },
      },
    );
  });

  return (
    <LoginFormContext.Provider
      value={{
        form,
        submit,
        isLoggingIn: loginMutation.isPending || loginMutation.isSuccess,
        loginError: loginMutation.error,
        clearError: loginMutation.reset,
      }}
    >
      {children}
    </LoginFormContext.Provider>
  );
}

export function useLoginFormContext() {
  const context = useContext(LoginFormContext);

  if (!context) {
    throw new Error(
      "useLoginFormContext يجب ان تكون بداخل LoginFormContextProvider",
    );
  }
  return context;
}
