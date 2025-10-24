"use client";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import useLoginWithProvider from "../hooks/useLoginWithProvider";
import { AuthProviderClass } from "../types/AuthProviderClass";
import toast from "react-hot-toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import { IconType } from "react-icons";

type SochialButtonProps = {
  title: string;
  Icon: IconType;
  provider: AuthProviderClass;
};

export default function SochialButton({
  title,
  Icon,
  provider,
}: SochialButtonProps) {
  const { loginWithProvider, providerLoading, providerError } =
    useLoginWithProvider();
  const router = useRouter();

  const handleLogin = async (Provider: AuthProviderClass) => {
    const success = await loginWithProvider(Provider);
    if (success) {
      toast.success("تم تسجيل الدخول بنجاح\n ابدأ ادارة متجرك مع Dealzora🔥!");
      router.replace("dealzora/dashboard");
    } else if (providerError) {
      toast.error(providerError);
    }
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      type="button"
      disabled={providerLoading}
      onClick={() => handleLogin(provider)}
      className="flex-1 p-3 rounded-md border border-gray-300 flex items-center justify-center gap-2 hover:bg-gray-100 transition"
    >
      <Icon
        className={`${title === "Google" ? "text-red-500" : "text-black"}`}
        size={20}
      />
      {providerLoading ? <LoadingSpinner /> : <>{title}</>}
    </motion.button>
  );
}
