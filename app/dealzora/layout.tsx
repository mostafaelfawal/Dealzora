import { ReactNode } from "react";
import AuthGuard from "@/components/AuthGuard";
import SideMenu from "@/components/SideBar/SideMenu";

export default function DealzoraLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <SideMenu />
      <main className="min-h-screen bg-gray-200 px-22">{children}</main>
    </AuthGuard>
  );
}
