import RequiredMark from "@/components/RequiredMark";
import { IconType } from "react-icons";
import { motion } from "framer-motion";

type InputProps = {
  label: string;
  icon: React.ReactElement<IconType>;
  register: any;
  error?: string;
  required?: boolean;
};

export default function SupplierInput({
  label,
  icon,
  register,
  error,
  required,
}: InputProps) {
  return (
    <div className="w-full">
      {/* Label */}
      <label className="block mb-1 text-sm font-medium text-gray-700">
        {label} {required && <RequiredMark />}
      </label>

      {/* Input Wrapper */}
      <div
        className={`relative flex items-center rounded-lg border transition-all duration-300 ${
          error
            ? "border-red-500 focus-within:ring-red-500"
            : "border-gray-300 focus-within:border-blue-500 focus-within:ring-blue-500"
        } focus-within:ring-2`}
      >
        <span className="absolute right-3 text-gray-400">{icon}</span>
        <input
          {...register}
          placeholder={`ادخل ${label}`}
          className="w-full pr-10 pl-3 py-2 bg-transparent rounded-lg focus:outline-none text-gray-700"
        />
      </div>

      {/* Error Message */}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-red-500 text-xs mt-1 font-medium"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}
