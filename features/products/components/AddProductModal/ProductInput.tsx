import RequiredMark from "@/components/RequiredMark";
import { FieldErrors } from "react-hook-form";
import { motion } from "framer-motion";
import { SupplierType } from "@/features/suppliers/types/SupplierType";
import {
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  SelectChangeEvent,
} from "@mui/material";
import { useState, useEffect } from "react";
import { FaUserPlus } from "react-icons/fa";
import Tooltip from "@/components/Tooltip";
import Link from "next/link";

type ProductInputProps = {
  label: string;
  register: any;
  errors: FieldErrors;
  required?: boolean;
  type?: "text" | "category" | "suppliers";
  categories?: string[];
  icon: React.ReactElement;
  suppliers?: SupplierType[];
};

export default function ProductInput({
  label,
  register,
  errors,
  required = false,
  type = "text",
  categories = [],
  icon,
  suppliers,
}: ProductInputProps) {
  const fieldName = register.name;
  const fieldError = errors[fieldName]?.message as string | undefined;
  const dataListId = `${fieldName}-list`;

  // الحصول على دالة onChange و value من register
  const { onChange, value } = register;

  const [selectedSupplier, setSelectedSupplier] = useState(value || "");

  // مزامنة القيمة مع react-hook-form عند التغيير
  const handleSupplierChange = (event: SelectChangeEvent) => {
    const newValue = event.target.value;
    setSelectedSupplier(newValue);

    // تحديث react-hook-form بالقيمة الجديدة
    onChange({
      target: {
        name: fieldName,
        value: newValue,
      },
    });
  };

  useEffect(() => {
    setSelectedSupplier(value || "");
  }, [value]);

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
      <label
        htmlFor={label}
        className="flex items-center gap-2 font-medium text-gray-700"
      >
        {icon}
        <span>
          {label} {required && <RequiredMark />}
        </span>
      </label>

      {type === "suppliers" ? (
        <div className="flex gap-2 items-center">
          <FormControl fullWidth size="small" className="flex-1">
            <InputLabel id={`${fieldName}-label`}>اختر المورد</InputLabel>
            <Select
              labelId={`${fieldName}-label`}
              id={fieldName}
              value={selectedSupplier}
              label="اختر المورد"
              onChange={handleSupplierChange}
              sx={{
                borderRadius: "8px",
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#d1d5db",
                },
                "&:hover .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#3b82f6",
                },
                "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#3b82f6",
                  borderWidth: "2px",
                },
              }}
            >
              <MenuItem value="">
                <em>اختر مورد</em>
              </MenuItem>
              {suppliers?.map((supplier) => (
                <MenuItem
                  key={supplier.id}
                  value={supplier.id}
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div className="font-medium">{supplier.name}</div>
                    {supplier.companyName && (
                      <div className="text-sm text-gray-500">
                        {supplier.companyName}
                      </div>
                    )}
                  </div>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* زر إضافة مورد جديد */}
          <Tooltip message="إضافة مورد جديد" side="bottom">
            <Link
              href="/dealzora/suppliers/add-supplier"
              type="button"
              className="flex items-center justify-center bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg transition-colors duration-200"
            >
              <FaUserPlus className="text-lg" />
            </Link>
          </Tooltip>
        </div>
      ) : (
        <input {...inputProps} />
      )}

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
          className="text-red-500 font-semibold text-sm mt-1"
        >
          {fieldError}
        </motion.p>
      )}
    </div>
  );
}
