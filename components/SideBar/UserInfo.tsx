"use client"
import useLogout from "@/features/auth/hooks/useLogout";
import { RootState } from "@/store/store";
import Image from "next/image";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { FiLogOut } from "react-icons/fi";
import { useSelector } from "react-redux";

export default function UserInfo({
  hovered,
}: {
  hovered: boolean;
}) {
  const { logout, error, loading } = useLogout();
  const router = useRouter();

  const handleLogout = async () => {
    const success = await logout();
    if (success) router.replace("/auth");
    else toast.error(error);
  };
  const user = useSelector((state: RootState) => state.user.currentUser);

  return (
    <div className="p-4 border-t border-blue-500 bg-blue-700/30 flex items-center justify-center gap-3 flex-row-reverse">
      {hovered && (
        <div className="flex-1 flex items-center justify-between flex-row-reverse">
          <button
            onClick={handleLogout}
            disabled={loading}
            className="p-2 hover:bg-blue-500 disabled:text-gray-500 rounded-full transition"
            title="تسجيل الخروج"
          >
            <FiLogOut className="text-lg" />
          </button>
          <div className="text-right">
            <span className="block text-sm font-medium">
              {user?.name ?? "مستخدم Dealzora"}
            </span>
            <span className="block text-xs text-blue-200">
              {user?.email ?? "example@email.com"}
            </span>
          </div>
        </div>
      )}
      <Image
        src={user?.avatar ?? "/default_avatar.png"}
        alt="User"
        width={40}
        height={40}
        className="rounded-full border border-white/30"
      />
    </div>
  );
}
