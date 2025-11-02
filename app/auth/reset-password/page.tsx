"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { FiLock } from "react-icons/fi";
import { auth } from "@/firebase/firebase";
import { verifyPasswordResetCode, confirmPasswordReset } from "firebase/auth";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import PasswordInput from "@/features/auth/components/PasswordInput";
import {
  resetPasswordSchema,
  ResetPasswordSchema,
} from "@/features/auth/schemas/resetPasswordSchema";

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useSearchParams();
  const oobCode = params.get("oobCode");
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  //  تحقق من صلاحية الكود
  useEffect(() => {
    const checkCode = async () => {
      if (!oobCode) {
        toast.error("رابط غير صالح ❌");
        router.replace("/auth");
        return;
      }

      try {
        const userEmail = await verifyPasswordResetCode(auth, oobCode);
        setEmail(userEmail);
      } catch {
        toast.error("الرابط غير صالح أو منتهي الصلاحية ❌");
        router.replace("/auth");
      } finally {
        setLoading(false);
      }
    };

    checkCode();
  }, [oobCode, router]);

  //  react-hook-form setup
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordSchema>({
    resolver: zodResolver(resetPasswordSchema),
  });

  //  تنفيذ إعادة التعيين
  const onSubmit = async (data: ResetPasswordSchema) => {
    try {
      await confirmPasswordReset(auth, oobCode!, data.password);
      toast.success("تمت إعادة تعيين كلمة المرور بنجاح ");
      router.replace("/auth");
    } catch {
      toast.error("حدث خطأ أثناء إعادة التعيين ❌");
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-600">
        جاري التحقق من الرابط...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white shadow-lg rounded-2xl p-8 w-full max-w-md border border-gray-100"
      >
        {/* شعار الموقع */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600">Dealzora</h1>
          <p className="text-sm text-gray-500 mt-1">نظام إدارة المتاجر</p>
        </div>

        {/* أيقونة */}
        <div className="flex items-center justify-center mb-6">
          <div className="bg-blue-100 text-blue-600 p-3 rounded-full">
            <FiLock size={26} />
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-center text-gray-800 mb-2">
          إعادة تعيين كلمة المرور
        </h2>
        <p className="text-center text-gray-500 mb-6 text-sm">
          {email
            ? `سيتم تعيين كلمة مرور جديدة للحساب: ${email}`
            : "يرجى إدخال كلمة مرور جديدة"}
        </p>

        {/* فورم */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="mb-4">
            <PasswordInput
              placeholder="كلمة المرور الجديدة"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-red-500 text-sm mt-1">
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="mb-6">
            <PasswordInput
              placeholder="تأكيد كلمة المرور"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-red-500 text-sm mt-1">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            disabled={isSubmitting}
            type="submit"
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2.5 rounded-md transition-colors disabled:bg-blue-300"
          >
            {isSubmitting ? "جاري الحفظ..." : "حفظ كلمة المرور الجديدة"}
          </motion.button>
        </form>

        {/* العودة */}
        <p className="text-center text-sm text-gray-500 mt-6">
          <span
            onClick={() => router.push("/auth")}
            className="text-blue-600 hover:underline cursor-pointer"
          >
            الرجوع لتسجيل الدخول
          </span>
        </p>
      </motion.div>
    </div>
  );
}
