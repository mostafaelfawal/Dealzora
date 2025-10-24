"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/store/store";
import { fetchUser } from "@/store/user/fetchUser";
import useAuthListener from "@/hooks/useAuthListener";
import Loading from "@/app/loading";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthListener();
  const router = useRouter();
  const pathname = usePathname(); // الصفحة الحالية
  const dispatch = useDispatch<AppDispatch>();

  // الصفحات اللي مسموح للمستخدم المسجل دخول يراها بدون تحويله للدashboard
  const authPages = ["/auth/reset-password"];

  useEffect(() => {
    if (loading) return;

    if (user) {
      dispatch(fetchUser());
      if (!authPages.includes(pathname)) {
        router.replace("/dashboard");
      }
    } else {
      if (!authPages.includes(pathname)) {
        router.replace("/auth");
      }
    }
  }, [user, loading, dispatch, router, pathname]);

  if (loading) return <Loading />;

  return <>{children}</>;
}
