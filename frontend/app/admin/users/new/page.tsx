import type { Metadata } from "next";

import { Suspense } from "react";
import UserFormContextProvider from "@/features/users/context/UserFormContext";
import { UserFormScreen } from "@/features/users/components/userFormScreen";
import { PlanGate } from "@/components/shared/PlanGate";

export const metadata: Metadata = { title: "مستخدم جديد" };

export default function NewUserPage() {
  return (
    <PlanGate feature="multi_user">
      <Suspense>
        <UserFormContextProvider>
          <UserFormScreen />
        </UserFormContextProvider>
      </Suspense>
    </PlanGate>
  );
}
