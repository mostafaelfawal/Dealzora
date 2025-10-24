"use client";

import { motion } from "framer-motion";
import { FaSearch, FaHome } from "react-icons/fa";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-linear-to-br from-blue-100 via-blue-300 to-blue-400 text-white overflow-hidden">
      {/* Icon */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="text-blue-900 bg-white/20 rounded-full p-6 mb-6 shadow-lg"
      >
        <FaSearch size={60} />
      </motion.div>

      {/* Text */}
      <motion.h1
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-2xl font-bold mb-2"
      >
        الصفحة غير موجودة 😕
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-sm text-white/90 mb-6 px-6 text-center max-w-md"
      >
        يبدو أن الصفحة التي تبحث عنها غير متاحة أو تم نقلها.
      </motion.p>

      {/* Back to home */}
      <motion.div
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 200 }}
      >
        <Link
          href="/"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-full shadow-md transition-colors"
        >
          <FaHome /> العودة إلى الرئيسية
        </Link>
      </motion.div>
    </div>
  );
}
