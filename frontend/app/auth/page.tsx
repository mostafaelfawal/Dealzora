"use client";

import { PageEnter } from "@/components/shared/PageEnter";
import { LoginScreen } from "@/features/auth/components/loginScreen";
import { DeviceSyncRunner } from "@/features/branchTransfers/components/deviceSyncRunner";
import LoginFormContextProvider from "@/features/auth/context/LoginFormContext";
import { BackendStartup } from "@/features/setup/components/backendStartup";
import { useSetupGate } from "@/features/setup/hooks/useSetupGate";

export default function LoginPage() {
  const { ready, failed, answered } = useSetupGate("login");
  if (!answered) return <BackendStartup failed={failed} />;
  if (!ready) return null; // ننتقل لصفحة الإعداد الأول

  return (
    <LoginFormContextProvider>
      <PageEnter>
        <LoginScreen />
      </PageEnter>
      {/* جهاز فرع: حسابات أنشأها المالك من جهازه تصل هنا قبل أي دخول */}
      <DeviceSyncRunner />
    </LoginFormContextProvider>
  );
}
