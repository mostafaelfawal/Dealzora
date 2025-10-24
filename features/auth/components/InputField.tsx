import { FC, InputHTMLAttributes } from "react";
import { motion } from "framer-motion";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

const InputField: FC<InputProps> = ({ error, ...props }) => (
  <div className="flex flex-col w-full">
    <input
      {...props}
      className={`w-full bg-gray-100 p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all ${
        error ? "border border-red-400" : ""
      }`}
    />
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

export default InputField;
