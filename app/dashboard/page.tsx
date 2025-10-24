"use client";
import LoadingSpinner from "@/components/LoadingSpinner";
import SideBar from "@/components/SideBar/SideBar";
import useLogout from "@/features/auth/hooks/useLogout";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { FaSignOutAlt } from "react-icons/fa";

export default function Dashboard() {
  

  return (
    <div>
      <SideBar />
      <main className="min-h-screen">
      </main>
    </div>
  );
}
