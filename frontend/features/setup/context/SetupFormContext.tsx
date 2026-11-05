"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, type ReactNode, useContext, useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";

import { AUTH_ROUTES } from "@/features/auth/config/authRoutes";
import { saveLastLogin, saveSession } from "@/features/auth/lib/authStorage";
import { ApiError } from "@/lib/axios";

import { runSetup } from "../lib/runSetup";
import {
  cleanShopName,
  cleanUsername,
  setupSchema,
  type SetupSchemaType,
} from "../schema/setup.schema";
import type { SetupStep } from "../types/setup";

type SetupFormContextType = {
  form: UseFormReturn<SetupSchemaType>;
  submit: (event?: React.BaseSyntheticEvent) => Promise<void>;
  step: SetupStep;
  isSubmitting: boolean;
  errorMessage: string | null;
  clearError: () => void;
};

const SetupFormContext = createContext<SetupFormContextType | null>(null);

export default function SetupFormContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<SetupStep>("idle");

  const form = useForm<SetupSchemaType>({
    resolver: zodResolver(setupSchema),
    mode: "onTouched",
    defaultValues: { shopName: "", username: "", password: "", confirm: "" },
  });

  const mutation = useMutation({
    mutationFn: (v: SetupSchemaType) =>
      runSetup(
        {
          shopName: cleanShopName(v.shopName),
          username: cleanUsername(v.username),
          password: v.password,
        },
        setStep,
      ),
    onSuccess: (session) => {
      saveSession(session);
      saveLastLogin({
        role: session.user.role,
        username: session.user.username,
      });
      queryClient.clear();
      router.replace(AUTH_ROUTES.home[session.user.role]);
    },
    onError: (error) => {
      setStep("idle");
      if (error instanceof ApiError && error.code === "already_setup") {
        router.replace(AUTH_ROUTES.login);
      }
    },
  });

  const errorMessage = mutation.error
    ? mutation.error instanceof Error
      ? mutation.error.message
      : "تعذّر إكمال الإعداد. حاول مرة أخرى."
    : null;

  return (
    <SetupFormContext.Provider
      value={{
        form,
        submit: form.handleSubmit((v) => mutation.mutate(v)),
        step,
        isSubmitting: mutation.isPending || mutation.isSuccess,
        errorMessage,
        clearError: mutation.reset,
      }}
    >
      {children}
    </SetupFormContext.Provider>
  );
}

export function useSetupFormContext() {
  const ctx = useContext(SetupFormContext);
  if (!ctx)
    throw new Error(
      "useSetupFormContext يجب ان تكون بداخل SetupFormContextProvider",
    );
  return ctx;
}
