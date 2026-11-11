import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AUTH_ROUTES } from "@/features/auth/config/authRoutes";

import { fetchSetupRequired } from "../api/setup.api";
import { SETUP_ROUTE } from "../config/setupOptions";

/** expect="setup": تبقى هنا فقط لو النظام يحتاج إعداداً. expect="login": العكس. */
export function useSetupGate(expect: "setup" | "login") {
  const router = useRouter();
  const { data: setupRequired, isError } = useQuery({
    queryKey: ["setup-status"],
    queryFn: fetchSetupRequired,
    // الـ backend قد يحتاج ثوانٍ ليقلع (أول تشغيل لنسخة الـ exe + مضاد الفيروسات): حتى دقيقة.
    retry: 60,
    retryDelay: 1000,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (setupRequired === undefined) return;
    if (expect === "setup" && !setupRequired) router.replace(AUTH_ROUTES.login);
    if (expect === "login" && setupRequired) router.replace(SETUP_ROUTE);
  }, [setupRequired, expect, router]);

  return {
    ready:
      setupRequired !== undefined && setupRequired === (expect === "setup"),
    /** الخادم لم يرد بعد كل المحاولات. */
    failed: isError,
    /** وصل رد من الخادم (حتى لو سننتقل لصفحة أخرى). */
    answered: setupRequired !== undefined,
  };
}
