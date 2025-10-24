"use client"
import { FC, useState, InputHTMLAttributes } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { motion } from "framer-motion";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

const PasswordInput: FC<Props> = ({ error, ...props }) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={showPassword ? "text" : "password"}
        className={`w-full bg-gray-100 p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all ${
          error ? "border border-red-400" : ""
        }`}
      />
      <button
        type="button"
        className="absolute top-4 left-3 text-gray-500 hover:text-blue-500 transition-colors duration-200"
        onClick={() => setShowPassword(!showPassword)}
      >
        {showPassword ? <FaEyeSlash /> : <FaEye />}
      </button>
      {error && (
        <motion.p
          initial={{ rotate: 20, opacity: 0.5 }}
          animate={{ rotate: 0, opacity: 1 }}
          className="text-red-500 text-sm font-semibold"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
};

export default PasswordInput;
