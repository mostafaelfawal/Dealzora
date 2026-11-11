"use client";

import { LoginScreen } from "@/features/auth/components/loginScreen";
import LoginFormContextProvider from "@/features/auth/context/LoginFormContext";
import { BackendStartup } from "@/features/setup/components/backendStartup";
import { useSetupGate } from "@/features/setup/hooks/useSetupGate";

export default function LoginPage() {
  const { ready, failed, answered } = useSetupGate("login");
  if (!answered) return <BackendStartup failed={failed} />;
  if (!ready) return null; // ننتقل لصفحة الإعداد الأول

  return (
    <LoginFormContextProvider>
      <LoginScreen />
    </LoginFormContextProvider>
  );
}
