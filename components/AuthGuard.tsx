"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/store/store";
import { fetchUser } from "@/store/user/fetchUser";
import useAuthListener from "@/hooks/useAuthListener";
import Loading from "@/app/loading";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthListener();
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    if (loading) return;

    if (user) {
      dispatch(fetchUser());
      router.replace("/dashboard");
    } else {
      router.replace("/auth");
    }
  }, [user, loading, dispatch, router]);

  if (loading) return <Loading />;

  return <>{children}</>;
}
