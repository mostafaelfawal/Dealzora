import RequiredMark from "@/components/RequiredMark";
import { FieldErrors } from "react-hook-form";
import { motion } from "framer-motion";

type ProductInputProps = {
  label: string;
  register: any;
  errors: FieldErrors;
  required?: boolean;
  type?: "text" | "category"; 
  categories?: string[];
};

export default function ProductInput({
  label,
  register,
  errors,
  required = false,
  type = "text",
  categories = [],
}: ProductInputProps) {
  const fieldName = register.name;
  const fieldError = errors[fieldName]?.message as string | undefined;
  const dataListId = `${fieldName}-list`;

  const inputType = "text";

  const inputProps = {
    id: label,
    type: inputType,
    list: type === "category" ? dataListId : undefined,
    className:
      "transition-shadow duration-200 rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400",
    ...register,
  };

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={label} className="font-medium text-gray-700">
        {label} {required && <RequiredMark />}
      </label>

      <input {...inputProps} />

      {/* إظهار datalist فقط للنوع category */}
      {type === "category" && (
        <datalist id={dataListId}>
          {categories.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>
      )}

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
