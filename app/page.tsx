"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useAuthListener from "@/hooks/useAuthListener";

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuthListener();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? "/dealzora/dashboard" : "/auth");
  }, [loading, router]);

  return null;
}
