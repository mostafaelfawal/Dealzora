"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useState } from "react";
import LoginHeader from "@/features/auth/components/LoginHeader";
import LoginForm from "@/features/auth/components/LoginForm";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(false);

  return (
    <div className="bg-linear-to-br from-blue-100 via-blue-300 to-blue-400 flex justify-center items-center min-h-screen p-1 md:p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="bg-white flex flex-col md:flex-row rounded-xl shadow-xl overflow-hidden max-w-5xl w-full"
      >
        {/* Left Section */}
        <div className="flex-1 py-10 px-8 md:px-12 space-y-8">
          <LoginHeader
            isLogin={isLogin}
            toggleLogin={() => setIsLogin(!isLogin)}
          />
          <LoginForm isLogin={isLogin} />
        </div>

        {/* Right Section */}
        <div className="hidden md:block flex-1 relative">
          <Image
            src="/auth_image.png"
            alt="Login Illustration"
            fill
            className="object-cover"
          />
        </div>
      </motion.div>
    </div>
  );
}
