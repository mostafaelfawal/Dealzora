"use client";

import { FC, useEffect, useState } from "react";
import { motion } from "framer-motion";
import InputField from "./InputField";
import PasswordInput from "./PasswordInput";
import SocialLogin from "./SocialLogin";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signinSchema, SigninSchema } from "../schemas/signinSchema";
import { loginSchema } from "../schemas/loginSchema";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import useRegisterWithEmail from "../hooks/useRegisterWithEmail";
import useLoginWithEmail from "../hooks/useloginWithEmail";
import useResetPassword from "../hooks/useResetPassword";
import { AuthFormData } from "../types/AuthFormData";
import Modal from "@/components/Modal";
import { FiLogIn, FiSend } from "react-icons/fi";

const LoginForm: FC<{ isLogin: boolean }> = ({ isLogin }) => {
  const schema = isLogin ? loginSchema : signinSchema;
  const { signin, loading, error } = useRegisterWithEmail();
  const { login, loadingLogin, errorLogin } = useLoginWithEmail();
  const { resetPassword, error: resetError, cooldown } = useResetPassword();
  const load = loadingLogin || loading;
  const [openModal, setOpenModal] = useState(false);
  const [emailForReset, setEmailForReset] = useState("");
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AuthFormData>({
    resolver: zodResolver(schema),
  });

  // مراقبة الأخطاء العامة
  useEffect(() => {
    toast.dismiss();
    if (error) toast.error(error);
  }, [error]);

  useEffect(() => {
    toast.dismiss();
    if (errorLogin) toast.error(errorLogin);
  }, [errorLogin]);

  useEffect(() => {
    if (resetError) toast.error(resetError);
  }, [resetError]);

  // تسجيل الدخول أو إنشاء الحساب
  const onSubmit = async (data: AuthFormData) => {
    const success = isLogin
      ? await login(data.email, data.password, data.remember!)
      : await signin(
          data.email.trim(),
          data.password.trim(),
          `${(data as SigninSchema).firstName.trim()} ${(
            data as SigninSchema
          ).lastName.trim()}`
        );

    if (!success) return;

    const fullName =
      !isLogin &&
      `${(data as SigninSchema).firstName.trim()} ${(
        data as SigninSchema
      ).lastName.trim()}`;

    toast.success(
      isLogin
        ? "اهلا بعودتك الى Dealzora👋 راجع متجرك👁"
        : `اهلا ${fullName} في Dealzora لإدارة متجرك بسهولة👋🔥`
    );

    router.replace("dealzora/dashboard");
  };

  //  إرسال رابط إعادة كلمة السر
  const handleForgotPassword = async () => {
    if (!emailForReset.trim()) {
      toast.error("يرجى إدخال بريدك الإلكتروني أولاً");
      return;
    }

    setOpenModal(false);

    toast.promise(resetPassword(emailForReset.trim()), {
      loading: "جاري إرسال الرابط...",
      success: "تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني ",
      error: "حدث خطأ أثناء إرسال الرابط ❌",
    });

    setEmailForReset("");
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {!isLogin && (
        <div className="flex gap-4">
          <InputField
            placeholder="الاسم الأول"
            {...register("firstName" as never)}
            error={errors.firstName?.message}
          />
          <InputField
            placeholder="الاسم الأخير"
            {...register("lastName" as never)}
            error={errors.lastName?.message}
          />
        </div>
      )}

      <InputField
        type="email"
        placeholder="البريد الإلكتروني"
        {...register("email")}
        error={errors.email?.message}
      />

      <PasswordInput
        placeholder="كلمة السر"
        {...register("password")}
        error={errors.password?.message}
      />

      {!isLogin && (
        <PasswordInput
          placeholder="تأكيد كلمة السر"
          {...register("confirmPassword" as never)}
          error={errors.confirmPassword?.message}
        />
      )}

      {isLogin && (
        <div className="flex justify-between items-center">
          <button
            type="button"
            disabled={cooldown ? true : false}
            onClick={() => setOpenModal(true)}
            className="underline disabled:text-gray-500 text-blue-500 hover:text-blue-700"
          >
            {cooldown > 0
              ? `أعد المحاولة بعد ${cooldown}s`
              : "هل نسيت كلمة السر؟"}
          </button>

          <div className="flex justify-center items-center gap-2">
            <label htmlFor="remember" className="text-gray-500 text-sm">
              تذكرني
            </label>
            <input
              id="remember"
              type="checkbox"
              {...register("remember")}
              className="w-4 h-4"
              checked
            />
          </div>
        </div>
      )}

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        type="submit"
        disabled={load}
        className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 transition-colors duration-300 text-white w-full py-3 rounded-md font-medium flex items-center justify-center gap-1"
      >
        {load ? <LoadingSpinner /> : <FiLogIn size={20} />}
        <span>{isLogin ? "سجّل الدخول" : "أنشئ حسابك"}</span>
      </motion.button>

      <div className="flex items-center gap-2 text-gray-400">
        <div className="h-px w-full bg-gray-300"></div>
        <span className="text-sm min-w-fit">أو سجل الدخول عبر</span>
        <div className="h-px w-full bg-gray-300"></div>
      </div>

      <SocialLogin />

      {/*  المودال */}
      {openModal && (
        <Modal title="نسيت كلمة السر" closeModal={() => setOpenModal(false)}>
          <p className="text-gray-600 mb-4">
            أدخل بريدك الإلكتروني لإرسال رابط استعادة كلمة المرور:
          </p>

          <input
            type="email"
            placeholder="البريد الإلكتروني"
            value={emailForReset}
            onChange={(e) => setEmailForReset(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 mb-4 outline-none focus:ring-2 focus:ring-blue-500"
          />

          <button
            onClick={handleForgotPassword}
            className="w-full bg-blue-500 text-white rounded-md py-2 hover:bg-blue-600 transition disabled:bg-blue-400 flex items-center justify-center gap-2"
          >
            <FiSend />
            إرسال الرابط
          </button>
        </Modal>
      )}
    </form>
  );
};

export default LoginForm;
