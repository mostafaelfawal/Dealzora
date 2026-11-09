import type { Metadata } from "next";

import { UsersScreen } from "@/features/users/components/usersScreen";

export const metadata: Metadata = { title: "المستخدمين" };

export default function UsersPage() {
  return <UsersScreen />;
}
