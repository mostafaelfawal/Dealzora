"use client";
import { motion } from "framer-motion";
import Image from "next/image";
import { FaHeart } from "react-icons/fa";

export default function Loading() {
  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-linear-to-br from-blue-100 via-blue-300 to-blue-400 text-white overflow-hidden">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, rotate: -50, scale: 0.9 }}
        animate={{ opacity: 1, rotate: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative w-32 h-32 mb-10 drop-shadow-lg select-none"
      >
        <Image
          src="/og-image.png"
          alt="Dealzora logo"
          className="object-contain rounded-full"
          fill
          priority
        />
      </motion.div>

      {/* Animated loader dots */}
      <div className="flex space-x-2 mb-16">
        <span className="w-5 h-5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
        <span className="w-5 h-5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
        <span className="w-5 h-5 bg-blue-500 rounded-full animate-bounce"></span>
      </div>

      {/* Footer text */}
      <p className="absolute bottom-6 flex items-center gap-2 text-sm text-white/90">
        تم بواسطة
        <FaHeart className="text-red-500 animate-pulse" />
        <span className="font-semibold">مصطفى حمدي</span>
      </p>
    </div>
  );
}
