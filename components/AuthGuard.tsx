"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store/store";
import { fetchUser } from "@/store/user/fetchUser";
import useAuthListener from "@/hooks/useAuthListener";
import Loading from "@/app/loading";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthListener();
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const authPages = ["/auth/reset-password", "/auth"];
  const currentPath = usePathname();
  const isUser = useSelector((state: RootState) => state.user.currentUser);
  
  useEffect(() => {
    if (loading) return;

    if (user) {
      if (!isUser?.name) dispatch(fetchUser());
      if (!authPages.includes(currentPath)) {
        router.replace("/dealzora/dashboard");
      }
    } else {
      if (!authPages.includes(currentPath)) {
        router.replace("/auth");
      }
    }
  }, [user, loading, dispatch, router]);

  if (loading) return <Loading />;

  return <>{children}</>;
}
