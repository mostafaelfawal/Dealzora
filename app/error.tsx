"use client";

import { motion } from "framer-motion";
import { FaRedo, FaExclamationTriangle } from "react-icons/fa";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: VoidFunction;
}) {
  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-linear-to-br from-blue-100 via-blue-300 to-blue-400 text-white overflow-hidden">
      {/* Icon */}
      <motion.div
        initial={{ rotate: -10, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="text-blue-800 bg-white/20 rounded-full p-6 mb-6 shadow-lg"
      >
        <FaExclamationTriangle size={60} />
      </motion.div>

      {/* Text */}
      <motion.h1
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-2xl font-bold mb-2"
      >
        حدث خطأ غير متوقع 😢
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-sm text-white/90 mb-6 px-6 text-center max-w-md"
      >
        {error.message || "حدث خلل أثناء تحميل الصفحة، حاول مرة أخرى."}
      </motion.p>

      {/* Retry button */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => reset()}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-full shadow-md transition-colors"
      >
        <FaRedo /> حاول مجددًا
      </motion.button>
    </div>
  );
}
