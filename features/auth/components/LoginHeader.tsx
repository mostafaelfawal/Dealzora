"use client";

import { FC } from "react";

interface Props {
  isLogin: boolean;
  toggleLogin: VoidFunction;
}

const LoginHeader: FC<Props> = ({ isLogin, toggleLogin }) => (
  <div>
    <h2 className="text-3xl font-semibold text-gray-800">
      {isLogin ? "مرحباً بعودتك!" : "ابدأ رحلتك مع Dealzora"}
    </h2>
    <p className="text-sm mt-2 text-gray-500">
      {isLogin ? "ليس لديك حساب بعد؟" : "هل لديك حساب بالفعل؟"}
      <span
        onClick={toggleLogin}
        className="underline cursor-pointer text-blue-500 hover:text-blue-700"
      >
        {isLogin ? " أنشئ حسابك الآن" : " سجّل الدخول"}
      </span>
    </p>
  </div>
);

export default LoginHeader;
