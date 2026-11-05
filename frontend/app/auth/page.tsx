"use client";

import { LoginScreen } from "@/features/auth/components/loginScreen";
import LoginFormContextProvider from "@/features/auth/context/LoginFormContext";
import { useSetupGate } from "@/features/setup/hooks/useSetupGate";

export default function LoginPage() {
  const ready = useSetupGate("login");
  if (!ready) return null;

  return (
    <LoginFormContextProvider>
      <LoginScreen />
    </LoginFormContextProvider>
  );
}
