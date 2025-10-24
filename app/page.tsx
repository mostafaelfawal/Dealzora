"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useAuthListener from "@/hooks/useAuthListener";
import Loading from "./loading";

export default function Home() {
  const router = useRouter();
  const { loading } = useAuthListener();

  useEffect(() => {
    if (loading) return;
    router.replace("/dealzora/dashboard");
  }, [loading, router]);

  return <Loading />;
}
