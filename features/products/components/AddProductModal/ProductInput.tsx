import RequiredMark from "@/components/RequiredMark";
import { FieldErrors } from "react-hook-form";
import { motion } from "framer-motion";

export default function ProductInput({
  label,
  errors,
  register,
  required = false,
}: {
  label: string;
  errors: FieldErrors;
  register: any;
  required?: boolean;
}) {
  const fieldName = register.name;
  const fieldError = errors[fieldName]?.message as string | undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={label} className="font-medium text-gray-700">
        {label} {required && <RequiredMark />}
      </label>
      <input
        id={label}
        className="transition-shadow duration-200 rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
        {...register}
      />
      {fieldError && (
        <motion.p
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="text-red-500 font-semibold"
        >
          {fieldError}
        </motion.p>
      )}
    </div>
  );
}
