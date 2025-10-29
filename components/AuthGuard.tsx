"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store/store";
import useAuthListener from "@/hooks/useAuthListener";
import Loading from "@/app/loading";
import { fetchUser } from "@/features/auth/slices/fetchUser";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthListener();
  const router = useRouter();
  const path = usePathname();
  const dispatch = useDispatch<AppDispatch>();
  const isUser = useSelector((state: RootState) => state.user.currentUser);

  useEffect(() => {
    if (loading) return;

    if (user) {
      if (!isUser?.name) dispatch(fetchUser());
      router.replace(path);
    } else {
      router.replace("/auth");
    }
  }, [user, loading, dispatch, router]);

  if (loading) return <Loading />;

  return <>{children}</>;
}
