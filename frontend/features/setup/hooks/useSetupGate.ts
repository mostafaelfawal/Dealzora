import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AUTH_ROUTES } from "@/features/auth/config/authRoutes";

import { fetchSetupRequired } from "../api/setup.api";
import { SETUP_ROUTE } from "../config/setupOptions";

/** expect="setup": تبقى هنا فقط لو النظام يحتاج إعداداً. expect="login": العكس. */
export function useSetupGate(expect: "setup" | "login") {
  const router = useRouter();
  const { data: setupRequired } = useQuery({
    queryKey: ["setup-status"],
    queryFn: fetchSetupRequired,
    retry: 10, // الـ backend قد يحتاج ثوانٍ ليقلع
    retryDelay: 500,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (setupRequired === undefined) return;
    if (expect === "setup" && !setupRequired) router.replace(AUTH_ROUTES.login);
    if (expect === "login" && setupRequired) router.replace(SETUP_ROUTE);
  }, [setupRequired, expect, router]);

  return setupRequired !== undefined && setupRequired === (expect === "setup");
}
