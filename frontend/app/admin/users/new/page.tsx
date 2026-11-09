import type { Metadata } from "next";

import { Suspense } from "react";
import UserFormContextProvider from "@/features/users/context/UserFormContext";
import { UserFormScreen } from "@/features/users/components/userFormScreen";

export const metadata: Metadata = { title: "مستخدم جديد" };

export default function NewUserPage() {
  return (
    <Suspense>
      <UserFormContextProvider>
        <UserFormScreen />
      </UserFormContextProvider>
    </Suspense>
  );
}
