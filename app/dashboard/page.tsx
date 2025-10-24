"use client";
import LoadingSpinner from "@/components/LoadingSpinner";
import SideBar from "@/components/SideBar/SideBar";
import useLogout from "@/features/auth/hooks/useLogout";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { FaSignOutAlt } from "react-icons/fa";

export default function Dashboard() {
  const { logout, error, loading } = useLogout();
  const router = useRouter();

  const onSignOut = async () => {
    const success = await logout();
    if (success) router.replace("/auth");
    else toast.error(error);
  };

  return (
    <div>
      <SideBar />
      <main className="min-h-screen">ss</main>
    </div>
  );
}
